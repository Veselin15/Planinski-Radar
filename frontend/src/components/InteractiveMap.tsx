"use client";

import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

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

const defaultMarkerIcon = L.icon({
  iconUrl: markerIcon.src,
  iconRetinaUrl: markerIcon2x.src,
  shadowUrl: markerShadow.src,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});

// Set a global default marker icon so Leaflet markers render correctly in Next.js.
L.Marker.prototype.options.icon = defaultMarkerIcon;

export default function InteractiveMap() {
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
    <MapContainer center={center} zoom={7} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {huts.map((feature, index) => {
        const [lng, lat] = feature.geometry.coordinates;
        return (
          <Marker key={`hut-${feature.id ?? index}`} position={[lat, lng]}>
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
          <Marker key={`hazard-${feature.id ?? index}`} position={[lat, lng]}>
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
  );
}
