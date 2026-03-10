"use client";

import dynamic from "next/dynamic";
import { FormEvent, useState } from "react";

const InteractiveMap = dynamic(() => import("../../components/InteractiveMap"), {
  ssr: false,
});

export default function MapPage() {
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [category, setCategory] = useState("avalanche");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleAddingMode = () => {
    // Toggle add mode and clear any selected point when turning it off.
    setIsAddingMode((previous) => {
      const nextValue = !previous;
      if (!nextValue) {
        setSelectedLocation(null);
      }
      return nextValue;
    });
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    // Store the clicked map coordinates to prefill form submission target.
    setSelectedLocation({ lat, lng });
  };

  const handleSubmitHazard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedLocation || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Send a GeoJSON-compatible payload expected by the DRF endpoint.
      const response = await fetch("http://localhost:8000/api/hazards/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location: {
            type: "Point",
            coordinates: [selectedLocation.lng, selectedLocation.lat],
          },
          category,
          description,
          is_active: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit hazard report.");
      }

      // Reset interaction state and refresh markers after successful submission.
      setSelectedLocation(null);
      setIsAddingMode(false);
      window.location.reload();
    } catch (error) {
      // Log failures so we can add user-facing toasts in a later iteration.
      console.error("Error while submitting hazard:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-slate-900">
      {/* Keep the map as the base visual layer covering the whole screen. */}
      <div className="absolute inset-0 z-0">
        <InteractiveMap
          isAddingMode={isAddingMode}
          onLocationSelect={handleLocationSelect}
        />
      </div>

      {/* Render floating map filters as a non-blocking top overlay. */}
      <div className="pointer-events-none absolute top-4 left-4 right-4 z-10 flex items-start justify-between">
        <div className="pointer-events-auto rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/20"
            >
              🏔️ Всички
            </button>
            <button
              type="button"
              className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/20"
            >
              🏕️ Хижи
            </button>
            <button
              type="button"
              className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white transition hover:bg-white/20"
            >
              ⚠️ Опасности
            </button>
          </div>
        </div>
      </div>

      {isAddingMode && (
        <div className="pointer-events-none absolute top-20 left-4 right-4 z-20 flex justify-center">
          <div className="rounded-full border border-slate-700 bg-slate-900/85 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-md">
            Цъкнете върху картата, за да маркирате опасност
          </div>
        </div>
      )}

      {/* Provide a large floating action button for quick hazard reporting. */}
      <button
        type="button"
        onClick={toggleAddingMode}
        aria-label="Добави сигнал за опасност"
        className="pointer-events-auto absolute bottom-8 right-6 z-10 flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-3xl text-white shadow-2xl transition-transform hover:bg-red-500 active:scale-95"
      >
        {isAddingMode ? "✕" : "⚠️"}
      </button>

      {selectedLocation && (
        <section className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-slate-700 bg-slate-900/95 p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
          {/* Use a compact bottom sheet to capture hazard details after point pick. */}
          <form className="space-y-4" onSubmit={handleSubmitHazard}>
            <div className="space-y-2">
              <label
                htmlFor="hazard-category"
                className="text-sm font-semibold text-slate-200"
              >
                Категория
              </label>
              <select
                id="hazard-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 text-sm text-white focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="avalanche">Лавина</option>
                <option value="ice">Заледяване</option>
                <option value="fallen_tree">Паднало дърво</option>
                <option value="other">Друго</option>
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="hazard-description"
                className="text-sm font-semibold text-slate-200"
              >
                Описание
              </label>
              <textarea
                id="hazard-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Опишете опасността..."
                rows={4}
                className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-12 w-full rounded-xl bg-blue-600 text-base font-semibold text-white shadow-lg transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {isSubmitting ? "Изпращане..." : "Изпрати сигнал"}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
