from django.db import transaction
from django.db.models import F
from rest_framework.permissions import IsAuthenticated, IsAuthenticatedOrReadOnly
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from .models import AtesZone, Hazard, HazardVote, Hut, OfficialAlert
from .serializers import (
    AtesZoneSerializer,
    HazardSerializer,
    HutSerializer,
    OfficialAlertSerializer,
)


class HazardViewSet(ModelViewSet):
    # Allow reading and creating active hazards from the map workflow.
    queryset = Hazard.objects.filter(is_active=True)
    serializer_class = HazardSerializer
    permission_classes = [IsAuthenticatedOrReadOnly]

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
