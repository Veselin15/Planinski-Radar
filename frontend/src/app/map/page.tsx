"use client";

import dynamic from "next/dynamic";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import {
  addPendingHazardReport,
  flushPendingHazardReports,
  getPendingHazardCount,
} from "../../lib/offlineHazardQueue";

type FeedItem = {
  item_type: "hazard" | "official_alert";
  id: number;
  title: string;
  description: string;
  source?: string;
  author_name?: string;
  created_at: string;
};

const InteractiveMap = dynamic(() => import("../../components/InteractiveMap"), {
  ssr: false,
});

export default function MapPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const googleIdToken = session?.googleIdToken;
  const [isAddingMode, setIsAddingMode] = useState(false);
  const [locateTrigger, setLocateTrigger] = useState(0);
  const [activeFilter, setActiveFilter] = useState<"all" | "huts" | "hazards">(
    "all",
  );
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("avalanche");
  const [description, setDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [isFeedOpen, setIsFeedOpen] = useState(false);
  const [pendingQueueCount, setPendingQueueCount] = useState(0);

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

  const handleHazardAction = async () => {
    // Require authentication before entering hazard reporting mode.
    if (!session) {
      alert("Моля, влезте в профила си, за да подадете сигнал.");
      router.push("/auth?callbackUrl=/map");
      return;
    }

    toggleAddingMode();
  };

  const handleLocationSelect = (lat: number, lng: number) => {
    // Store the clicked map coordinates to prefill form submission target.
    setSelectedLocation({ lat, lng });
  };

  const handleLocateMe = () => {
    // Increment a trigger counter so the map can start geolocation on demand.
    setLocateTrigger((previous) => previous + 1);
  };

  useEffect(() => {
    // Load pending offline reports count for quick visibility.
    setPendingQueueCount(getPendingHazardCount());
  }, []);

  useEffect(() => {
    if (!googleIdToken) {
      return;
    }

    const syncQueue = async () => {
      if (!navigator.onLine) {
        return;
      }
      const result = await flushPendingHazardReports(googleIdToken);
      setPendingQueueCount(result.remaining);
      if (result.sent > 0) {
        alert(`Изпратени офлайн сигнали: ${result.sent}.`);
        window.location.reload();
      }
    };

    void syncQueue();
    const onOnline = () => void syncQueue();
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
    };
  }, [googleIdToken]);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchFeed = async () => {
      try {
        // Load a short feed window for the map-side bottom sheet.
        const response = await fetch("http://localhost:8000/api/feed/?page_size=10", {
          signal: abortController.signal,
        });
        if (!response.ok) {
          throw new Error("Failed to load feed.");
        }
        const data = (await response.json()) as { results?: FeedItem[] };
        setFeedItems(data.results ?? []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Error while loading feed:", error);
        }
      }
    };

    fetchFeed();
    const intervalId = window.setInterval(fetchFeed, 60000);

    return () => {
      abortController.abort();
      window.clearInterval(intervalId);
    };
  }, []);

  const handleSubmitHazard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedLocation || isSubmitting) {
      return;
    }

    const normalizedDescription = description.trim();
    if (!normalizedDescription) {
      // Block empty reports early to avoid backend validation errors.
      alert("Моля, добавете описание на опасността.");
      return;
    }

    if (!session) {
      // Protect API from anonymous submissions even if the form is somehow open.
      alert("Моля, влезте в профила си, за да подадете сигнал.");
      router.push("/auth?callbackUrl=/map");
      return;
    }
    if (!googleIdToken) {
      // Require a valid Google ID token before calling protected backend endpoints.
      alert("Сесията е изтекла. Моля, влезте отново.");
      router.push("/auth?callbackUrl=/map");
      return;
    }

    setIsSubmitting(true);

    const buildFormData = () => {
      const formData = new FormData();
      formData.append("category", selectedCategory);
      formData.append("description", normalizedDescription);
      formData.append("is_active", "true");
      formData.append("author_name", session.user?.name || "Anonymous");
      formData.append(
        "location",
        JSON.stringify({
          type: "Point",
          coordinates: [selectedLocation.lng, selectedLocation.lat],
        }),
      );
      if (imageFile) {
        formData.append("image", imageFile);
      }
      return formData;
    };

    try {
      if (!navigator.onLine) {
        addPendingHazardReport({
          category: selectedCategory,
          description: normalizedDescription,
          authorName: session.user?.name || "Anonymous",
          location: selectedLocation,
          createdAt: new Date().toISOString(),
          hadImage: Boolean(imageFile),
        });
        const nextQueueCount = getPendingHazardCount();
        setPendingQueueCount(nextQueueCount);
        setSelectedLocation(null);
        setIsAddingMode(false);
        setImageFile(null);
        alert(
          imageFile
            ? "Нямате интернет. Сигналът е запазен офлайн, но снимката няма да бъде качена."
            : "Нямате интернет. Сигналът е запазен офлайн и ще бъде изпратен автоматично при връзка.",
        );
        return;
      }

      // Let the browser set multipart headers with the correct boundary.
      const response = await fetch("http://localhost:8000/api/hazards/", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleIdToken}`,
        },
        body: buildFormData(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to submit hazard report.");
      }

      // Reset interaction state and refresh markers after successful submission.
      setSelectedLocation(null);
      setIsAddingMode(false);
      setImageFile(null);
      window.location.reload();
    } catch (error) {
      // Queue reports when network request fails unexpectedly.
      const networkError =
        error instanceof TypeError ||
        (error instanceof Error && /network|failed to fetch/i.test(error.message));
      if (networkError) {
        addPendingHazardReport({
          category: selectedCategory,
          description: normalizedDescription,
          authorName: session.user?.name || "Anonymous",
          location: selectedLocation,
          createdAt: new Date().toISOString(),
          hadImage: Boolean(imageFile),
        });
        const nextQueueCount = getPendingHazardCount();
        setPendingQueueCount(nextQueueCount);
        setSelectedLocation(null);
        setIsAddingMode(false);
        setImageFile(null);
        alert(
          imageFile
            ? "Проблем с мрежата. Сигналът е запазен офлайн, но снимката няма да бъде качена."
            : "Проблем с мрежата. Сигналът е запазен офлайн и ще бъде изпратен при връзка.",
        );
      } else {
        console.error("Error while submitting hazard:", error);
        alert("Неуспешно изпращане на сигнал. Моля, опитайте отново.");
      }
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
          locateTrigger={locateTrigger}
          activeFilter={activeFilter}
          authToken={googleIdToken}
          onAuthRequired={() => router.push("/auth?callbackUrl=/map")}
        />
      </div>

      {/* Render floating map filters as a non-blocking top overlay. */}
      <div className="pointer-events-none absolute top-4 left-4 right-4 z-10 flex items-start justify-between">
        <div className="pointer-events-auto rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 shadow-lg backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                activeFilter === "all"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              🏔️ Всички
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("huts")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                activeFilter === "huts"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              🏕️ Хижи
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("hazards")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                activeFilter === "hazards"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              ⚠️ Опасности
            </button>
          </div>
        </div>

        <div className="pointer-events-auto ml-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-2 shadow-lg backdrop-blur-md">
          {session ? (
            <div className="flex items-center gap-2">
              {session.user?.image ? (
                <img
                  src={session.user.image}
                  alt="Профилна снимка"
                  className="h-7 w-7 rounded-full border border-slate-600 object-cover"
                />
              ) : (
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-xs text-white">
                  👤
                </span>
              )}
              <span className="max-w-24 truncate text-xs font-medium text-white">
                {session.user?.name || "Потребител"}
              </span>
              <button
                type="button"
                onClick={() => signOut()}
                className="rounded-full bg-slate-700 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-slate-600"
              >
                Изход
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/auth?callbackUrl=/map")}
              className="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-500"
            >
              Вход с Google
            </button>
          )}
        </div>
      </div>

      {!isOnline ? (
        <div className="pointer-events-none absolute left-4 right-4 top-20 z-20 flex justify-center">
          <div className="rounded-full border border-amber-400/50 bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-100 shadow-lg backdrop-blur-md">
            Няма интернет. Показваме кеширана карта и данни.
          </div>
        </div>
      ) : null}

      {pendingQueueCount > 0 ? (
        <div className="pointer-events-none absolute left-4 right-4 top-32 z-20 flex justify-center">
          <div className="rounded-full border border-blue-400/40 bg-blue-500/10 px-4 py-2 text-xs font-semibold text-blue-100 shadow-lg backdrop-blur-md">
            Офлайн опашка: {pendingQueueCount} сигнал(а) чакат изпращане.
          </div>
        </div>
      ) : null}

      {isAddingMode && (
        <div className="pointer-events-none absolute top-20 left-4 right-4 z-20 flex justify-center">
          <div className="rounded-full border border-slate-700 bg-slate-900/85 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-md">
            Цъкнете върху картата, за да маркирате опасност
          </div>
        </div>
      )}

      {/* Add a quick locate button above the main action button. */}
      <button
        type="button"
        onClick={handleLocateMe}
        aria-label="Покажи моята локация"
        className="absolute bottom-28 right-6 z-10 w-12 h-12 bg-white text-slate-800 rounded-full shadow-lg flex items-center justify-center text-xl transition-transform active:scale-95"
      >
        🎯
      </button>

      {/* Provide a large floating action button for quick hazard reporting. */}
      <button
        type="button"
        onClick={handleHazardAction}
        aria-label="Добави сигнал за опасност"
        className="pointer-events-auto absolute bottom-8 right-6 z-10 flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-3xl text-white shadow-2xl transition-transform hover:bg-red-500 active:scale-95"
      >
        {isAddingMode ? "✕" : "⚠️"}
      </button>

      {/* Show a mobile-first live feed toggle and bottom sheet above the map. */}
      <button
        type="button"
        onClick={() => setIsFeedOpen((previous) => !previous)}
        className="pointer-events-auto absolute bottom-8 left-6 z-10 rounded-full border border-slate-700 bg-slate-900/90 px-4 py-2 text-xs font-semibold text-white shadow-xl backdrop-blur-md"
      >
        {isFeedOpen ? "Скрий сигнали" : "Последни сигнали"}
      </button>

      {isFeedOpen && (
        <section className="pointer-events-auto absolute bottom-24 left-4 right-4 z-20 max-h-72 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-md">
          <h3 className="mb-2 text-sm font-semibold text-white">Последни сигнали</h3>
          <div className="space-y-2">
            {feedItems.length === 0 ? (
              <p className="text-xs text-slate-300">Няма налични сигнали в момента.</p>
            ) : (
              feedItems.map((item) => (
                <article
                  key={`${item.item_type}-${item.id}`}
                  className="rounded-xl border border-slate-700 bg-slate-800/80 p-2.5"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        item.item_type === "hazard"
                          ? "bg-red-500/20 text-red-200"
                          : "bg-blue-500/20 text-blue-200"
                      }`}
                    >
                      {item.item_type === "hazard" ? "Потребителски" : "Официален"}
                    </span>
                    <time className="text-[10px] text-slate-400">
                      {new Date(item.created_at).toLocaleString("bg-BG")}
                    </time>
                  </div>
                  <p className="text-xs font-semibold text-white">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-300">{item.description}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {item.item_type === "hazard"
                      ? `Подадено от: ${item.author_name || "Анонимен"}`
                      : `Източник: ${item.source || "Официален канал"}`}
                  </p>
                </article>
              ))
            )}
          </div>
        </section>
      )}

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
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
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
                required
                rows={4}
                className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <input
              type="file"
              accept="image/*"
              onChange={(event) => setImageFile(event.target.files?.[0] || null)}
              className="w-full text-sm text-slate-400 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
            />

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
