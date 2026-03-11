from rest_framework_gis.serializers import GeoFeatureModelSerializer

from .models import AtesZone, Hazard, Hut, OfficialAlert


class HazardSerializer(GeoFeatureModelSerializer):
    # Serialize hazard points as GeoJSON features.
    class Meta:
        model = Hazard
        geo_field = "location"
        # Keep explicit fields to guarantee author_name is always exposed in API payloads.
        fields = [
            "id",
            "location",
            "category",
            "description",
            "image",
            "upvotes",
            "author",
            "author_name",
            "is_active",
            "created_at",
            "updated_at",
        ]
        # Prevent clients from forging trust counters or author metadata.
        read_only_fields = ["upvotes", "author", "author_name", "created_at", "updated_at"]


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
