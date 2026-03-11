from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import (
    AtesZoneViewSet,
    FeedView,
    HazardViewSet,
    HutViewSet,
    OfficialAlertViewSet,
    SystemHealthView,
    WebcamSnapshotViewSet,
)

router = DefaultRouter()
router.register("hazards", HazardViewSet, basename="hazard")
router.register("huts", HutViewSet, basename="hut")
router.register("official-alerts", OfficialAlertViewSet, basename="official-alert")
router.register("ates-zones", AtesZoneViewSet, basename="ates-zone")
router.register("webcam-snapshots", WebcamSnapshotViewSet, basename="webcam-snapshot")

urlpatterns = [
    path("feed/", FeedView.as_view(), name="feed"),
    path("system/health/", SystemHealthView.as_view(), name="system-health"),
] + router.urls
