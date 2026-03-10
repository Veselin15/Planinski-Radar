from rest_framework_gis.serializers import GeoFeatureModelSerializer

from .models import AtesZone, Hazard, Hut, OfficialAlert


class HazardSerializer(GeoFeatureModelSerializer):
    # Serialize hazard points as GeoJSON features.
    class Meta:
        model = Hazard
        geo_field = "location"
        fields = "__all__"


class HutSerializer(GeoFeatureModelSerializer):
    # Serialize hut points as GeoJSON features.
    class Meta:
        model = Hut
        geo_field = "location"
        fields = "__all__"


class OfficialAlertSerializer(GeoFeatureModelSerializer):
    # Serialize alert locations as GeoJSON features.
    class Meta:
        model = OfficialAlert
        geo_field = "location"
        fields = "__all__"


class AtesZoneSerializer(GeoFeatureModelSerializer):
    # Serialize ATES polygons as GeoJSON features.
    class Meta:
        model = AtesZone
        geo_field = "zone_polygon"
        fields = "__all__"
