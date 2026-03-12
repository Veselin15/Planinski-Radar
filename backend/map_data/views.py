from django.db import transaction
from django.db.models import F
from django.utils.dateparse import parse_datetime
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from .models import (
    AtesZone,
    Hazard,
    HazardFlag,
    HazardVote,
    Hut,
    OfficialAlert,
    WebcamSnapshot,
)
from .serializers import (
    AtesZoneSerializer,
    HazardSerializer,
    HutSerializer,
    OfficialAlertSerializer,
    WebcamSnapshotSerializer,
)


class HazardReportThrottle(UserRateThrottle):
    # Limit how often a single user can submit new hazard reports.
    scope = "hazard_report"


class HazardUpvoteThrottle(UserRateThrottle):
    # Limit voting burst traffic from a single user.
    scope = "hazard_upvote"


class HazardResolveThrottle(UserRateThrottle):
    # Limit repeated resolve actions in a short period.
    scope = "hazard_resolve"


class HazardFlagThrottle(UserRateThrottle):
    # Limit how often users can report hazard quality issues.
    scope = "hazard_flag"


class HazardViewSet(ModelViewSet):
    # Allow reading and creating active hazards from the map workflow.
    queryset = Hazard.objects.filter(is_active=True)
    serializer_class = HazardSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

    def get_throttles(self):
        # Apply throttling only to write-heavy actions.
        if self.action == "create":
            throttle_classes = [HazardReportThrottle]
        elif self.action == "upvote":
            throttle_classes = [HazardUpvoteThrottle]
        elif self.action == "resolve":
            throttle_classes = [HazardResolveThrottle]
        elif self.action == "report":
            throttle_classes = [HazardFlagThrottle]
        else:
            throttle_classes = []
        return [throttle() for throttle in throttle_classes]

    def perform_create(self, serializer):
        # Persist both FK author and display author_name from authenticated user.
        display_name = (
            self.request.user.get_full_name().strip()
            or self.request.user.first_name
            or self.request.user.username
            or "Anonymous"
        )
        serializer.save(author=self.request.user, author_name=display_name)

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def upvote(self, request, pk=None):
        # Enforce one vote per user and atomically increment the trust score.
        hazard = self.get_object()

        with transaction.atomic():
            vote, created = HazardVote.objects.get_or_create(
                user=request.user,
                hazard=hazard,
            )
            if created:
                Hazard.objects.filter(pk=hazard.pk).update(upvotes=F("upvotes") + 1)

        hazard.refresh_from_db(fields=["upvotes"])
        if not created:
            return Response(
                {"upvotes": hazard.upvotes, "detail": "You already upvoted this hazard."}
            )
        return Response({"upvotes": hazard.upvotes})

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def report(self, request, pk=None):
        # Allow users to flag signals that look invalid or outdated.
        hazard = self.get_object()
        reason = request.data.get("reason", "outdated")
        allowed_reasons = {"outdated", "not_real", "duplicate", "other"}
        if reason not in allowed_reasons:
            reason = "other"

        flag, created = HazardFlag.objects.get_or_create(
            user=request.user,
            hazard=hazard,
            defaults={"reason": reason},
        )
        if not created and flag.reason != reason:
            flag.reason = reason
            flag.save(update_fields=["reason"])

        report_count = hazard.flags.count()
        if report_count >= 3 and hazard.is_active:
            hazard.status = Hazard.Status.FLAGGED_FOR_REVIEW
            hazard.is_active = False
            hazard.save(update_fields=["status", "is_active", "updated_at"])

        detail = "Report submitted."
        if not created:
            detail = "You already reported this hazard."
        return Response(
            {
                "detail": detail,
                "report_count": report_count,
                "status": hazard.status,
                "is_active": hazard.is_active,
            }
        )

    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated])
    def resolve(self, request, pk=None):
        # Allow the original author (or staff) to mark hazard as no longer active.
        hazard = self.get_object()

        if not (hazard.author_id == request.user.id or request.user.is_staff):
            return Response(
                {"detail": "Only the hazard author can resolve this signal."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not hazard.is_active:
            return Response({"is_active": False, "detail": "Hazard is already resolved."})

        hazard.is_active = False
        hazard.status = Hazard.Status.RESOLVED_BY_AUTHOR
        hazard.save(update_fields=["is_active", "status", "updated_at"])
        return Response(
            {
                "is_active": False,
                "status": hazard.status,
                "detail": "Hazard has been resolved.",
            }
        )


class HutViewSet(ReadOnlyModelViewSet):
    # Return all known huts.
    queryset = Hut.objects.all()
    serializer_class = HutSerializer


class OfficialAlertViewSet(ReadOnlyModelViewSet):
    # Return only currently active official alerts.
    queryset = OfficialAlert.objects.filter(is_active=True)
    serializer_class = OfficialAlertSerializer


class AtesZoneViewSet(ReadOnlyModelViewSet):
    # Return all ATES terrain zones.
    queryset = AtesZone.objects.all()
    serializer_class = AtesZoneSerializer


class WebcamSnapshotViewSet(ReadOnlyModelViewSet):
    # Return cached webcam snapshots ordered by freshness.
    queryset = WebcamSnapshot.objects.select_related("hut").order_by("-fetched_at")
    serializer_class = WebcamSnapshotSerializer


class FeedView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        # Return a unified chronological feed from user hazards and official alerts.
        feed_type = request.query_params.get("type", "all")
        try:
            page = max(int(request.query_params.get("page", 1)), 1)
        except (TypeError, ValueError):
            page = 1
        try:
            page_size = min(max(int(request.query_params.get("page_size", 20)), 1), 50)
        except (TypeError, ValueError):
            page_size = 20
        since_param = request.query_params.get("since")
        since_dt = parse_datetime(since_param) if since_param else None
        if since_dt and timezone.is_naive(since_dt):
            since_dt = timezone.make_aware(since_dt, timezone.get_current_timezone())

        feed_items = []

        if feed_type in {"all", "hazards"}:
            hazards = Hazard.objects.order_by("-created_at")
            if since_dt:
                hazards = hazards.filter(created_at__gte=since_dt)
            for hazard in hazards:
                feed_items.append(
                    {
                        "item_type": "hazard",
                        "id": hazard.id,
                        "title": hazard.category,
                        "description": hazard.description,
                        "author_name": hazard.author_name,
                        "upvotes": hazard.upvotes,
                        "status": hazard.status,
                        "is_active": hazard.is_active,
                        "image": hazard.image.url if hazard.image else None,
                        "coordinates": [hazard.location.x, hazard.location.y],
                        "created_at": hazard.created_at,
                    }
                )

        if feed_type in {"all", "official"}:
            alerts = OfficialAlert.objects.filter(is_active=True).order_by("-created_at")
            if since_dt:
                alerts = alerts.filter(created_at__gte=since_dt)
            for alert in alerts:
                feed_items.append(
                    {
                        "item_type": "official_alert",
                        "id": alert.id,
                        "title": alert.title,
                        "description": alert.description,
                        "source": alert.source,
                        "source_url": alert.source_url,
                        "coordinates": (
                            [alert.location.x, alert.location.y] if alert.location else None
                        ),
                        "created_at": alert.created_at,
                    }
                )

        # Keep feed globally ordered by most recent event.
        feed_items.sort(key=lambda item: item["created_at"], reverse=True)
        total_items = len(feed_items)
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_items = feed_items[start_idx:end_idx]

        return Response(
            {
                "count": total_items,
                "page": page,
                "page_size": page_size,
                "results": paginated_items,
            }
        )


class SystemHealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        # Return lightweight health metrics for API and ingestion visibility.
        return Response(
            {
                "status": "ok",
                "timestamp": timezone.now(),
                "metrics": {
                    "active_hazards": Hazard.objects.filter(is_active=True).count(),
                    "active_official_alerts": OfficialAlert.objects.filter(is_active=True).count(),
                    "latest_webcam_snapshot_at": WebcamSnapshot.objects.order_by("-fetched_at")
                    .values_list("fetched_at", flat=True)
                    .first(),
                },
            }
        )
