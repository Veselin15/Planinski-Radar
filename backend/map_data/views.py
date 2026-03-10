from rest_framework.viewsets import ReadOnlyModelViewSet

from .models import AtesZone, Hazard, Hut, OfficialAlert
from .serializers import (
    AtesZoneSerializer,
    HazardSerializer,
    HutSerializer,
    OfficialAlertSerializer,
)


class HazardViewSet(ReadOnlyModelViewSet):
    # Return only active hazards for the map feed.
    queryset = Hazard.objects.filter(is_active=True)
    serializer_class = HazardSerializer


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
