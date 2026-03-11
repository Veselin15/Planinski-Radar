from django.contrib.gis.admin import GISModelAdmin
from django.contrib import admin

from .models import AtesZone, Hazard, HazardVote, Hut, OfficialAlert, WebcamSnapshot


@admin.register(Hazard)
class HazardAdmin(GISModelAdmin):
    # Display the most relevant moderation and lifecycle fields in list view.
    list_display = (
        "id",
        "category",
        "author_name",
        "upvotes",
        "is_active",
        "created_at",
        "updated_at",
    )
    # Allow fast filtering by hazard type and current status.
    list_filter = ("category", "is_active", "created_at")
    # Enable text search through hazard notes.
    search_fields = ("description",)
    # Keep newest hazard reports at the top by default.
    ordering = ("-created_at",)


@admin.register(HazardVote)
class HazardVoteAdmin(admin.ModelAdmin):
    # Surface vote ownership to support abuse investigations in admin.
    list_display = ("id", "user", "hazard", "created_at")
    # Support vote filtering by date.
    list_filter = ("created_at",)
    # Enable quick search by username and hazard id.
    search_fields = ("user__username", "hazard__id")
    # Keep latest votes at the top.
    ordering = ("-created_at",)


@admin.register(Hut)
class HutAdmin(GISModelAdmin):
    # Show key hut metadata for quick review in admin list.
    list_display = ("id", "name", "elevation", "created_at", "updated_at")
    # Support filtering by elevation and creation timeline.
    list_filter = ("created_at", "updated_at")
    # Search by hut name and related webcam URL.
    search_fields = ("name", "webcam_url")
    # Keep hut records alphabetically ordered for easier scanning.
    ordering = ("name",)


@admin.register(OfficialAlert)
class OfficialAlertAdmin(GISModelAdmin):
    # Surface source, title, and state fields for alert operations.
    list_display = ("id", "source", "title", "is_active", "published_at", "created_at")
    # Provide filters by source, active state, and creation date.
    list_filter = ("source", "is_active", "created_at")
    # Allow searching alert records by source and text content.
    search_fields = ("source", "title", "description")
    # Show newest alerts first to prioritize recent notices.
    ordering = ("-created_at",)


@admin.register(AtesZone)
class AtesZoneAdmin(GISModelAdmin):
    # Expose zone type and description preview in the table listing.
    list_display = ("id", "zone_type", "description")
    # Enable filtering by the ATES complexity category.
    list_filter = ("zone_type",)
    # Support searching descriptive notes for terrain zones.
    search_fields = ("description",)


@admin.register(WebcamSnapshot)
class WebcamSnapshotAdmin(admin.ModelAdmin):
    # Expose snapshot freshness and status for cache monitoring.
    list_display = ("id", "hut", "status", "fetched_at")
    # Filter snapshots by status and recency.
    list_filter = ("status", "fetched_at")
    # Support quick lookups by hut name and source URL.
    search_fields = ("hut__name", "source_url")
    # Keep latest snapshots first.
    ordering = ("-fetched_at",)
