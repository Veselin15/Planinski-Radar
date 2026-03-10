from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet, ReadOnlyModelViewSet

from .models import AtesZone, Hazard, Hut, OfficialAlert
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

    @action(detail=True, methods=["post"])
    def upvote(self, request, pk=None):
        # Increment trust signal for this hazard and return fresh count.
        hazard = self.get_object()
        hazard.upvotes += 1
        hazard.save(update_fields=["upvotes"])
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
