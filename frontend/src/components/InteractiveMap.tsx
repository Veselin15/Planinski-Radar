"use client";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from "react-leaflet";

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

type HazardProperties = {
  category?: string;
  description?: string;
  upvotes?: number;
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

type InteractiveMapProps = {
  isAddingMode?: boolean;
  onLocationSelect?: (lat: number, lng: number) => void;
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

export default function InteractiveMap({
  isAddingMode = false,
  onLocationSelect,
}: InteractiveMapProps) {
  const [huts, setHuts] = useState<GeoFeature<HutProperties>[]>([]);
  const [hazards, setHazards] = useState<GeoFeature<HazardProperties>[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    // Prevent rendering Leaflet map before the component mounts on the client.
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchGeoJsonData = async () => {
      try {
        // Fetch huts and hazards in parallel for faster initial render.
        const [hutsResponse, hazardsResponse] = await Promise.all([
          fetch("http://localhost:8000/api/huts/", {
            signal: abortController.signal,
          }),
          fetch("http://localhost:8000/api/hazards/", {
            signal: abortController.signal,
          }),
        ]);

        if (!hutsResponse.ok || !hazardsResponse.ok) {
          throw new Error("Failed to fetch map layers.");
        }

        const hutsData =
          (await hutsResponse.json()) as GeoFeatureCollection<HutProperties>;
        const hazardsData =
          (await hazardsResponse.json()) as GeoFeatureCollection<HazardProperties>;

        setHuts(hutsData.features ?? []);
        setHazards(hazardsData.features ?? []);
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

  const center = useMemo<[number, number]>(() => [42.7339, 25.4858], []);

  if (!isMounted) {
    return <div className="h-full w-full bg-slate-100" />;
  }

  return (
    <div className="relative h-full w-full z-0">
      <MapContainer
        center={center}
        zoom={7}
        className="h-full w-full z-0"
        scrollWheelZoom
      >
        {/* Keep map click handling isolated in a tiny child helper component. */}
        <MapClickHandler
          isAddingMode={isAddingMode}
          onLocationSelect={onLocationSelect}
        />

        <TileLayer
          attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
          url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
        />

        {huts.map((feature, index) => {
          const [lng, lat] = feature.geometry.coordinates;
          return (
            <Marker
              key={`hut-${feature.id ?? index}`}
              position={[lat, lng]}
              icon={hutIcon}
            >
              <Popup>
                <div className="space-y-1">
                  <p className="font-semibold">{feature.properties.name ?? "Hut"}</p>
                  <p className="text-sm text-slate-600">
                    Elevation:{" "}
                    {feature.properties.elevation
                      ? `${feature.properties.elevation} m`
                      : "N/A"}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {hazards.map((feature, index) => {
          const [lng, lat] = feature.geometry.coordinates;
          return (
            <Marker
              key={`hazard-${feature.id ?? index}`}
              position={[lat, lng]}
              icon={hazardIcon}
            >
              <Popup>
                <div className="space-y-1">
                  <p className="font-semibold">
                    {feature.properties.category ?? "Hazard"}
                  </p>
                  <p className="text-sm text-slate-600">
                    {feature.properties.description ?? "No description provided."}
                  </p>
                  <p className="text-xs text-slate-500">
                    Upvotes: {feature.properties.upvotes ?? 0}
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Render a lightweight overlay legend above the map content. */}
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
      </div>
    </div>
  );
}
