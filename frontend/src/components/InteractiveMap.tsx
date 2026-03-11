"use client";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMapEvents,
} from "react-leaflet";

type PointGeometry = {
  type: "Point";
  coordinates: [number, number];
};

type GeoFeature<TProperties = Record<string, unknown>> = {
  type: "Feature";
  id?: string | number;
  geometry: PointGeometry;
  properties: TProperties;
};

type GeoFeatureCollection<TProperties = Record<string, unknown>> = {
  type: "FeatureCollection";
  features: GeoFeature<TProperties>[];
};

type HutProperties = {
  name?: string;
  elevation?: number | null;
};

type WebcamSnapshot = {
  id: number;
  hut: number;
  hut_name?: string;
  source_url?: string | null;
  image?: string | null;
  status: "success" | "failed";
  error_message?: string | null;
  fetched_at: string;
};

type HazardProperties = {
  category?: string;
  description?: string;
  image?: string | null;
  upvotes?: number;
  author_name?: string;
};

type OfficialAlertProperties = {
  source?: string;
  title?: string;
  description?: string;
  source_url?: string | null;
};

// Use a custom HTML icon to visually distinguish hut points.
const hutIcon = L.divIcon({
  className: "bg-transparent border-none",
  html: '<div class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-emerald-500 text-lg shadow-lg">🏕️</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

// Use a custom HTML icon to visually distinguish hazard points.
const hazardIcon = L.divIcon({
  className: "bg-transparent border-none",
  html: '<div class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-red-500 text-sm shadow-lg">⚠️</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

// Use a custom HTML icon to visually distinguish official alerts.
const officialAlertIcon = L.divIcon({
  className: "bg-transparent border-none",
  html: '<div class="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-sm shadow-lg">📢</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

type InteractiveMapProps = {
  isAddingMode?: boolean;
  onLocationSelect?: (lat: number, lng: number) => void;
  locateTrigger?: number;
  activeFilter: "all" | "huts" | "hazards";
  authToken?: string;
  onAuthRequired?: () => void;
};

type MapClickHandlerProps = {
  isAddingMode: boolean;
  onLocationSelect?: (lat: number, lng: number) => void;
};

function MapClickHandler({ isAddingMode, onLocationSelect }: MapClickHandlerProps) {
  // Listen for map clicks and forward coordinates only in add mode.
  useMapEvents({
    click(event) {
      if (!isAddingMode || !onLocationSelect) {
        return;
      }

      onLocationSelect(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

type UserLocationMarkerProps = {
  locateTrigger: number;
};

function UserLocationMarker({ locateTrigger }: UserLocationMarkerProps) {
  const [userLocation, setUserLocation] = useState<L.LatLng | null>(null);

  // Subscribe to geolocation events and keep user position synced on the map.
  const map = useMapEvents({
    locationfound(event) {
      setUserLocation(event.latlng);
      map.flyTo(event.latlng, map.getZoom());
    },
    locationerror() {
      // Keep errors non-blocking when permission is delayed or denied.
      console.warn("Location access delayed or denied.");
    },
  });

  useEffect(() => {
    // Trigger browser geolocation every time the parent increments locateTrigger.
    if (locateTrigger > 0) {
      map.locate({
        setView: true,
        maxZoom: 16,
        timeout: 15000,
        enableHighAccuracy: true,
      });
    }
  }, [locateTrigger, map]);

  if (!userLocation) {
    return null;
  }

  return (
    <CircleMarker
      center={userLocation}
      radius={8}
      pathOptions={{
        fillColor: "#3b82f6",
        color: "white",
        weight: 2,
        fillOpacity: 1,
      }}
    />
  );
}

export default function InteractiveMap({
  isAddingMode = false,
  onLocationSelect,
  locateTrigger = 0,
  activeFilter,
  authToken,
  onAuthRequired,
}: InteractiveMapProps) {
  const [huts, setHuts] = useState<GeoFeature<HutProperties>[]>([]);
  const [hazards, setHazards] = useState<GeoFeature<HazardProperties>[]>([]);
  const [officialAlerts, setOfficialAlerts] = useState<GeoFeature<OfficialAlertProperties>[]>(
    [],
  );
  const [latestSnapshotsByHut, setLatestSnapshotsByHut] = useState<Record<number, WebcamSnapshot>>(
    {},
  );
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Prevent rendering Leaflet map before the component mounts on the client.
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchGeoJsonData = async () => {
      try {
        // Fetch map layers and webcam cache in parallel for faster initial render.
        const [hutsResponse, hazardsResponse, officialAlertsResponse, webcamSnapshotsResponse] =
          await Promise.all([
          fetch("http://localhost:8000/api/huts/", {
            signal: abortController.signal,
          }),
          fetch("http://localhost:8000/api/hazards/", {
            signal: abortController.signal,
          }),
          fetch("http://localhost:8000/api/official-alerts/", {
            signal: abortController.signal,
          }),
          fetch("http://localhost:8000/api/webcam-snapshots/", {
            signal: abortController.signal,
          }),
        ]);

        if (
          !hutsResponse.ok ||
          !hazardsResponse.ok ||
          !officialAlertsResponse.ok ||
          !webcamSnapshotsResponse.ok
        ) {
          throw new Error("Failed to fetch map layers.");
        }

        const hutsData =
          (await hutsResponse.json()) as GeoFeatureCollection<HutProperties>;
        const hazardsData =
          (await hazardsResponse.json()) as GeoFeatureCollection<HazardProperties>;
        const officialAlertsData =
          (await officialAlertsResponse.json()) as GeoFeatureCollection<OfficialAlertProperties>;
        const webcamSnapshotsPayload = (await webcamSnapshotsResponse.json()) as
          | WebcamSnapshot[]
          | { results?: WebcamSnapshot[] };
        const webcamSnapshotsData = Array.isArray(webcamSnapshotsPayload)
          ? webcamSnapshotsPayload
          : webcamSnapshotsPayload.results ?? [];

        setHuts(hutsData.features ?? []);
        setHazards(hazardsData.features ?? []);
        setOfficialAlerts(officialAlertsData.features ?? []);

        // Keep only the newest successful snapshot per hut for popup rendering.
        const nextLatestSnapshotsByHut = webcamSnapshotsData.reduce<Record<number, WebcamSnapshot>>(
          (accumulator, snapshot) => {
            if (snapshot.status !== "success" || !snapshot.image) {
              return accumulator;
            }
            if (accumulator[snapshot.hut]) {
              return accumulator;
            }
            accumulator[snapshot.hut] = snapshot;
            return accumulator;
          },
          {},
        );
        setLatestSnapshotsByHut(nextLatestSnapshotsByHut);
      } catch (error) {
        // Ignore abort errors and log only real request failures.
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Error while loading map data:", error);
        }
      }
    };

    fetchGeoJsonData();

    return () => {
      abortController.abort();
    };
  }, []);

  const handleUpvote = async (hazardId?: string | number) => {
    if (hazardId === undefined || hazardId === null) {
      return;
    }
    if (!authToken) {
      // Force login before allowing trust votes.
      alert("Моля, влезте в профила си, за да потвърдите опасност.");
      onAuthRequired?.();
      return;
    }

    // Apply an optimistic increment so the popup feedback feels immediate.
    setHazards((previousHazards) =>
      previousHazards.map((feature) =>
        feature.id === hazardId
          ? {
              ...feature,
              properties: {
                ...feature.properties,
                upvotes: (feature.properties.upvotes ?? 0) + 1,
              },
            }
          : feature,
      ),
    );

    try {
      const response = await fetch(
        `http://localhost:8000/api/hazards/${hazardId}/upvote/`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to upvote hazard.");
      }

      const data = (await response.json()) as { upvotes?: number };
      if (typeof data.upvotes === "number") {
        // Sync local state with backend value in case parallel votes changed the count.
        setHazards((previousHazards) =>
          previousHazards.map((feature) =>
            feature.id === hazardId
              ? {
                  ...feature,
                  properties: {
                    ...feature.properties,
                    upvotes: data.upvotes,
                  },
                }
              : feature,
          ),
        );
      }
    } catch (error) {
      // Revert optimistic update when the request fails.
      setHazards((previousHazards) =>
        previousHazards.map((feature) =>
          feature.id === hazardId
            ? {
                ...feature,
                properties: {
                  ...feature.properties,
                  upvotes: Math.max((feature.properties.upvotes ?? 1) - 1, 0),
                },
              }
            : feature,
        ),
      );
      console.error("Error while upvoting hazard:", error);
    }
  };

  const center = useMemo<[number, number]>(() => [42.7339, 25.4858], []);
  const baseMapConfig = useMemo(
    () => ({
      // Use BGMountains as the primary map source for Bulgarian trails.
      url: "https://bgmtile.kade.si/{z}/{x}/{y}.png",
      maxZoom: 18,
      attribution:
        'Map data: &copy; <a href="https://bgmountains.org/" target="_blank" rel="noreferrer">BGMountains</a> | Hosting: <a href="https://kade.si/" target="_blank" rel="noreferrer">kade.si</a>',
    }),
    [],
  );

  const resolveMediaUrl = (mediaUrl?: string | null) => {
    if (!mediaUrl) {
      return null;
    }
    if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) {
      return mediaUrl;
    }
    return `http://localhost:8000${mediaUrl}`;
  };

  if (!isMounted) {
    return <div className="h-full w-full bg-slate-100" />;
  }

  return (
    <div className="relative h-full w-full z-0">
      <MapContainer
        center={center}
        zoom={7}
        maxZoom={18}
        className="h-full w-full z-0"
        scrollWheelZoom
      >
        {/* Keep map click handling isolated in a tiny child helper component. */}
        <MapClickHandler
          isAddingMode={isAddingMode}
          onLocationSelect={onLocationSelect}
        />
        {/* Render live GPS position marker and follow user location on demand. */}
        <UserLocationMarker locateTrigger={locateTrigger} />

        <TileLayer
          key={baseMapConfig.url}
          maxZoom={baseMapConfig.maxZoom}
          attribution={baseMapConfig.attribution}
          url={baseMapConfig.url}
        />

        {activeFilter !== "hazards" &&
          huts.map((feature, index) => {
            const [lng, lat] = feature.geometry.coordinates;
            const hutId = Number(feature.id);
            const latestSnapshot = Number.isNaN(hutId) ? undefined : latestSnapshotsByHut[hutId];
            const snapshotImageUrl = resolveMediaUrl(latestSnapshot?.image);
            return (
              <Marker
                key={`hut-${feature.id ?? index}`}
                position={[lat, lng]}
                icon={hutIcon}
              >
                <Popup>
                  <div className="space-y-1">
                    <p className="font-semibold">{feature.properties.name ?? "Хижа"}</p>
                    <p className="text-sm text-slate-600">
                      Надморска височина:{" "}
                      {feature.properties.elevation
                        ? `${feature.properties.elevation} m`
                        : "Няма данни"}
                    </p>
                    {snapshotImageUrl ? (
                      <div className="space-y-1 pt-1">
                        <p className="text-xs font-medium text-slate-700">Последна камера</p>
                        <img
                          src={snapshotImageUrl}
                          alt={`Камера при ${feature.properties.name ?? "хижа"}`}
                          className="h-32 w-full rounded-md border border-slate-200 object-cover shadow-sm"
                          loading="lazy"
                        />
                        <p className="text-xs text-slate-500">
                          Обновено:{" "}
                          {latestSnapshot?.fetched_at
                            ? new Date(latestSnapshot.fetched_at).toLocaleString("bg-BG")
                            : "Няма данни"}
                        </p>
                      </div>
                    ) : (
                      <p className="pt-1 text-xs text-slate-500">
                        Няма налична снимка от камера за тази хижа.
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {activeFilter !== "huts" &&
          hazards.map((feature, index) => {
            const [lng, lat] = feature.geometry.coordinates;
            return (
              <Marker
                key={`hazard-${feature.id ?? index}`}
                position={[lat, lng]}
                icon={hazardIcon}
              >
                <Popup>
                  <div className="space-y-2">
                    <p className="font-semibold">
                      {feature.properties.category ?? "Опасност"}
                    </p>
                    <p className="text-sm text-slate-600">
                      {feature.properties.description ?? "Няма добавено описание."}
                    </p>
                    <p className="text-xs text-slate-500">
                      Подадено от: {feature.properties.author_name ?? "Анонимен"}
                    </p>
                    {feature.properties.image ? (
                      <img
                        src={feature.properties.image}
                        alt="Hazard condition"
                        className="w-full h-32 object-cover rounded-md mt-2 shadow-sm border border-slate-200"
                        loading="lazy"
                      />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleUpvote(feature.id)}
                      disabled={feature.id === undefined || feature.id === null}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
                    >
                      👍 Потвърди ({feature.properties.upvotes ?? 0})
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {officialAlerts.map((feature, index) => {
          const [lng, lat] = feature.geometry.coordinates;
          return (
            <Marker
              key={`official-alert-${feature.id ?? index}`}
              position={[lat, lng]}
              icon={officialAlertIcon}
            >
              <Popup>
                <div className="space-y-1">
                  <p className="font-semibold">
                    {feature.properties.title ?? "Официален бюлетин"}
                  </p>
                  <p className="text-sm text-slate-600">
                    {feature.properties.description ?? "Няма описание."}
                  </p>
                  <p className="text-xs text-slate-500">
                    Източник: {feature.properties.source ?? "Официален канал"}
                  </p>
                  {feature.properties.source_url ? (
                    <a
                      href={feature.properties.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-blue-600 underline"
                    >
                      Виж източника
                    </a>
                  ) : null}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Render a lightweight overlay legend above the map content. */}
      <div className="pointer-events-none absolute right-4 top-4 z-[1000] rounded-lg bg-slate-900/85 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-md">
        Базов слой: BG Mountains
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 z-[1000] rounded-xl bg-white/80 p-3 shadow-lg backdrop-blur-md">
        <p className="text-sm font-bold text-slate-900">Легенда</p>
        <div className="mt-2 flex items-center gap-2 text-sm text-slate-800">
          <span aria-hidden="true">🏕️</span>
          <span>Хижи</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-sm text-slate-800">
          <span aria-hidden="true">⚠️</span>
          <span>Опасности</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-sm text-slate-800">
          <span aria-hidden="true">📢</span>
          <span>Официални сигнали</span>
        </div>
      </div>
    </div>
  );
}
