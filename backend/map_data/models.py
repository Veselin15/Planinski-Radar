from django.contrib.gis.db import models


class Hazard(models.Model):
    # Spatial point describing where the hazard was reported.
    location = models.PointField()
    # Hazard category used for map filtering and analytics.
    category = models.CharField(
        max_length=20,
        choices=[
            ("avalanche", "Avalanche"),
            ("ice", "Ice"),
            ("fallen_tree", "Fallen Tree"),
            ("other", "Other"),
        ],
    )
    # Free text note describing the observed hazard.
    description = models.TextField()
    # Optional image provided by users to show hazard conditions.
    image = models.ImageField(upload_to="hazards/", null=True)
    # Community score that increases when users upvote a hazard.
    upvotes = models.IntegerField(default=0)
    # Soft-delete flag controlling whether hazard is visible in the app.
    is_active = models.BooleanField(default=True)
    # Creation timestamp for audit and sorting.
    created_at = models.DateTimeField(auto_now_add=True)
    # Last update timestamp for synchronization and edits.
    updated_at = models.DateTimeField(auto_now=True)


class Hut(models.Model):
    # Public hut name displayed to users on the map.
    name = models.CharField(max_length=255)
    # Geographic coordinates of the hut.
    location = models.PointField()
    # Optional elevation in meters above sea level.
    elevation = models.IntegerField(null=True)
    # Optional URL to a live webcam feed near the hut.
    webcam_url = models.URLField(null=True)
    # Creation timestamp for import and change tracking.
    created_at = models.DateTimeField(auto_now_add=True)
    # Last update timestamp for hut metadata changes.
    updated_at = models.DateTimeField(auto_now=True)


class OfficialAlert(models.Model):
    # Official organization identifier, for example PSS.
    source = models.CharField(max_length=100)
    # Short alert headline shown in alert lists.
    title = models.CharField(max_length=255)
    # Full alert body with recommendations and risk context.
    description = models.TextField()
    # Optional point location when the alert is geographically specific.
    location = models.PointField(null=True)
    # Flag indicating whether the official alert is currently active.
    is_active = models.BooleanField()
    # Creation timestamp matching the alert ingestion time.
    created_at = models.DateTimeField(auto_now_add=True)


class AtesZone(models.Model):
    # Polygon geometry defining the avalanche exposure zone boundary.
    zone_polygon = models.PolygonField()
    # ATES complexity level used for terrain risk communication.
    zone_type = models.CharField(
        max_length=20,
        choices=[
            ("simple", "Simple"),
            ("challenging", "Challenging"),
            ("complex", "Complex"),
        ],
    )
    # Optional details about seasonal behavior or zone caveats.
    description = models.TextField(null=True)
