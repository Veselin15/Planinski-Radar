from django.contrib.gis.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class Hazard(models.Model):
    class Status(models.TextChoices):
        # Signal is active and visible on the map.
        ACTIVE = "active", "Active"
        # Signal was resolved by its original author.
        RESOLVED_BY_AUTHOR = "resolved_by_author", "Resolved by Author"
        # Signal automatically expired due to age-based retention.
        AUTO_EXPIRED = "auto_expired", "Auto Expired"
        # Signal was flagged by the community and awaits moderation.
        FLAGGED_FOR_REVIEW = "flagged_for_review", "Flagged for Review"

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
    # Authenticated user who created this hazard report.
    author = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="hazards",
    )
    # Public display name for the user who submitted the report.
    author_name = models.CharField(max_length=100, default="Anonymous")
    # Soft-delete flag controlling whether hazard is visible in the app.
    is_active = models.BooleanField(default=True)
    # Lifecycle status used for moderation and audit transparency.
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    # Creation timestamp for audit and sorting.
    created_at = models.DateTimeField(auto_now_add=True)
    # Last update timestamp for synchronization and edits.
    updated_at = models.DateTimeField(auto_now=True)


class HazardVote(models.Model):
    # User that confirmed the hazard exists.
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="hazard_votes")
    # Hazard that received a trust vote.
    hazard = models.ForeignKey(Hazard, on_delete=models.CASCADE, related_name="votes")
    # Creation timestamp for vote auditing.
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Enforce one vote per user for each hazard.
        constraints = [
            models.UniqueConstraint(fields=["user", "hazard"], name="unique_hazard_vote")
        ]


class HazardFlag(models.Model):
    # User who reported this hazard as invalid or outdated.
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="hazard_flags")
    # Hazard that was reported by the community.
    hazard = models.ForeignKey(Hazard, on_delete=models.CASCADE, related_name="flags")
    # Optional reason selected by the reporting user.
    reason = models.CharField(max_length=32, default="outdated")
    # Creation timestamp for moderation audit.
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Enforce one community report per user per hazard.
        constraints = [
            models.UniqueConstraint(fields=["user", "hazard"], name="unique_hazard_flag")
        ]


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
    # Optional canonical URL pointing to the source alert page.
    source_url = models.URLField(null=True, blank=True)
    # Stable hash to deduplicate alerts across repeated scraping cycles.
    content_hash = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    # Timestamp from the source system when available.
    published_at = models.DateTimeField(null=True, blank=True)
    # Optional point location when the alert is geographically specific.
    location = models.PointField(null=True)
    # Flag indicating whether the official alert is currently active.
    is_active = models.BooleanField()
    # Creation timestamp matching the alert ingestion time.
    created_at = models.DateTimeField(auto_now_add=True)


class WebcamSnapshot(models.Model):
    class SnapshotStatus(models.TextChoices):
        # Snapshot was successfully fetched and cached.
        SUCCESS = "success", "Success"
        # Snapshot fetch failed and contains diagnostic details.
        FAILED = "failed", "Failed"

    # Hut for which this frame was fetched.
    hut = models.ForeignKey(Hut, on_delete=models.CASCADE, related_name="webcam_snapshots")
    # Source webcam URL used for fetching the snapshot.
    source_url = models.URLField()
    # Cached image file saved for fast in-app access.
    image = models.ImageField(upload_to="webcams/", null=True, blank=True)
    # Status of the latest fetch attempt.
    status = models.CharField(max_length=20, choices=SnapshotStatus.choices)
    # Optional error details for failed fetches.
    error_message = models.TextField(null=True, blank=True)
    # Snapshot fetch timestamp for timeline rendering.
    fetched_at = models.DateTimeField(auto_now_add=True)


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
