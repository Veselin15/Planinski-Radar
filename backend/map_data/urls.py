from rest_framework.routers import DefaultRouter

from .views import AtesZoneViewSet, HazardViewSet, HutViewSet, OfficialAlertViewSet

router = DefaultRouter()
router.register("hazards", HazardViewSet, basename="hazard")
router.register("huts", HutViewSet, basename="hut")
router.register("official-alerts", OfficialAlertViewSet, basename="official-alert")
router.register("ates-zones", AtesZoneViewSet, basename="ates-zone")

urlpatterns = router.urls
