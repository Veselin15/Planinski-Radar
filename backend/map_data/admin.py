from django.contrib.gis.admin import GISModelAdmin
from django.contrib import admin

from .models import (
    AtesZone,
    Hazard,
    HazardFlag,
    HazardVote,
    Hut,
    OfficialAlert,
    WebcamSnapshot,
)

RADAR_ADMIN_GROUP = "RadarAdmins"


def _is_radar_admin(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if user.is_superuser:
        return True
    return bool(user.is_staff and user.groups.filter(name=RADAR_ADMIN_GROUP).exists())


class RadarAdminMixin:
    """
    Restrict editing in Django admin to superusers or members of RadarAdmins group.

    Staff users outside the group can still log into /admin but cannot add/change/delete these models.
    """

    def has_view_permission(self, request, obj=None):
        return bool(request.user and request.user.is_active and request.user.is_staff)

    def has_module_permission(self, request):
        return self.has_view_permission(request)

    def has_add_permission(self, request):
        return _is_radar_admin(request.user)

    def has_change_permission(self, request, obj=None):
        return _is_radar_admin(request.user)

    def has_delete_permission(self, request, obj=None):
        return _is_radar_admin(request.user)


class HazardVoteInline(admin.TabularInline):
    model = HazardVote
    extra = 0
    autocomplete_fields = ("user",)
    readonly_fields = ("created_at",)


class HazardFlagInline(admin.TabularInline):
    model = HazardFlag
    extra = 0
    autocomplete_fields = ("user",)
    readonly_fields = ("created_at",)


@admin.register(Hazard)
class HazardAdmin(RadarAdminMixin, GISModelAdmin):
    # Display the most relevant moderation and lifecycle fields in list view.
    list_display = (
        "id",
        "category",
        "author_name",
        "upvotes",
        "status",
        "flag_count",
        "is_active",
        "created_at",
        "updated_at",
    )
    # Allow fast filtering by hazard type and current status.
    list_filter = ("category", "status", "is_active", "created_at")
    # Enable text search through hazard notes.
    search_fields = ("description",)
    # Keep newest hazard reports at the top by default.
    ordering = ("-created_at",)
    inlines = (HazardVoteInline, HazardFlagInline)
    readonly_fields = ("created_at", "updated_at", "upvotes")
    autocomplete_fields = ("author",)
    list_select_related = ("author",)
    fieldsets = (
        (None, {"fields": ("category", "status", "is_active")}),
        ("Content", {"fields": ("description", "image")}),
        ("Author", {"fields": ("author", "author_name")}),
        ("Location", {"fields": ("location",)}),
        ("Metadata", {"fields": ("upvotes", "created_at", "updated_at")}),
    )

    def flag_count(self, obj):
        # Show how many users flagged this hazard for moderation.
        return obj.flags.count()

    flag_count.short_description = "Flags"


@admin.register(HazardVote)
class HazardVoteAdmin(RadarAdminMixin, admin.ModelAdmin):
    # Surface vote ownership to support abuse investigations in admin.
    list_display = ("id", "user", "hazard", "created_at")
    # Support vote filtering by date.
    list_filter = ("created_at",)
    # Enable quick search by username and hazard id.
    search_fields = ("user__username", "hazard__id")
    # Keep latest votes at the top.
    ordering = ("-created_at",)


@admin.register(HazardFlag)
class HazardFlagAdmin(RadarAdminMixin, admin.ModelAdmin):
    # Surface moderation reports for manual triage.
    list_display = ("id", "user", "hazard", "reason", "created_at")
    # Filter by reason and timestamp.
    list_filter = ("reason", "created_at")
    # Support quick search by username and hazard id.
    search_fields = ("user__username", "hazard__id", "hazard__description")
    # Keep latest reports at the top.
    ordering = ("-created_at",)


@admin.register(Hut)
class HutAdmin(RadarAdminMixin, GISModelAdmin):
    # Show key hut metadata for quick review in admin list.
    list_display = ("id", "name", "elevation", "created_at", "updated_at")
    # Support filtering by elevation and creation timeline.
    list_filter = ("created_at", "updated_at")
    # Search by hut name and related webcam URL.
    search_fields = ("name", "webcam_url")
    # Keep hut records alphabetically ordered for easier scanning.
    ordering = ("name",)
    list_display = ("id", "name", "elevation", "webcam_url", "created_at", "updated_at")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        (None, {"fields": ("name", "elevation")}),
        ("Location", {"fields": ("location",)}),
        ("Webcam", {"fields": ("webcam_url",)}),
        ("Metadata", {"fields": ("created_at", "updated_at")}),
    )


@admin.register(OfficialAlert)
class OfficialAlertAdmin(RadarAdminMixin, GISModelAdmin):
    # Surface source, title, and state fields for alert operations.
    list_display = ("id", "source", "title", "is_active", "published_at", "created_at")
    # Provide filters by source, active state, and creation date.
    list_filter = ("source", "is_active", "created_at")
    # Allow searching alert records by source and text content.
    search_fields = ("source", "title", "description")
    # Show newest alerts first to prioritize recent notices.
    ordering = ("-created_at",)
    readonly_fields = ("created_at", "content_hash")
    fieldsets = (
        (None, {"fields": ("source", "is_active", "published_at")}),
        ("Content", {"fields": ("title", "description", "source_url")}),
        ("Location", {"fields": ("location",)}),
        ("Deduplication", {"fields": ("content_hash",)}),
        ("Metadata", {"fields": ("created_at",)}),
    )


@admin.register(AtesZone)
class AtesZoneAdmin(RadarAdminMixin, GISModelAdmin):
    # Expose zone type and description preview in the table listing.
    list_display = ("id", "zone_type", "description")
    # Enable filtering by the ATES complexity category.
    list_filter = ("zone_type",)
    # Support searching descriptive notes for terrain zones.
    search_fields = ("description",)


@admin.register(WebcamSnapshot)
class WebcamSnapshotAdmin(RadarAdminMixin, admin.ModelAdmin):
    # Expose snapshot freshness and status for cache monitoring.
    list_display = ("id", "hut", "status", "fetched_at")
    # Filter snapshots by status and recency.
    list_filter = ("status", "fetched_at")
    # Support quick lookups by hut name and source URL.
    search_fields = ("hut__name", "source_url")
    # Keep latest snapshots first.
    ordering = ("-fetched_at",)
    readonly_fields = ("fetched_at",)
    autocomplete_fields = ("hut",)
