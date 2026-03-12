"use client";

import dynamic from "next/dynamic";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { useToast } from "../../components/ToastProvider";
import { ApiError, apiRequest, getFriendlyErrorMessage } from "../../lib/api";

type FeedItem = {
  item_type: "hazard" | "official_alert";
  id: number;
  title: string;
  description: string;
  source?: string;
  author_name?: string;
  status?: "active" | "resolved_by_author" | "auto_expired" | "flagged_for_review";
  is_active?: boolean;
  created_at: string;
};

const FEED_PAGE_SIZE = 6;

const InteractiveMap = dynamic(() => import("../../components/InteractiveMap"), {
  ssr: false,
});

export default function MapPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { showToast } = useToast();
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
  const [feedCount, setFeedCount] = useState(0);
  const [feedPage, setFeedPage] = useState(1);
  const [canLoadMoreFeed, setCanLoadMoreFeed] = useState(false);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [isLoadingMap, setIsLoadingMap] = useState(true);
  const [hasOfficialAlerts, setHasOfficialAlerts] = useState(true);
  const [hasAnyWebcamSnapshot, setHasAnyWebcamSnapshot] = useState(true);
  const [isFeedOpen, setIsFeedOpen] = useState(false);
  const [mapRefreshTrigger, setMapRefreshTrigger] = useState(0);

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
      showToast("Моля, влезте в профила си, за да подадете сигнал.", "info");
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
    // Redirect on session expiration when user is in protected flow.
    if (status === "unauthenticated" && isAddingMode) {
      showToast("Сесията е изтекла. Моля, влезте отново.", "error");
      router.push("/auth?callbackUrl=/map");
      setIsAddingMode(false);
      setSelectedLocation(null);
    }
  }, [status, isAddingMode, router, showToast]);

  const loadFeedPage = async (page: number, append: boolean) => {
    try {
      setIsLoadingFeed(true);
      const data = await apiRequest<{ count?: number; results?: FeedItem[] }>(
        `/api/feed/?page=${page}&page_size=${FEED_PAGE_SIZE}`,
      );
      const nextResults = data.results ?? [];
      const totalCount = data.count ?? 0;
      setFeedCount(totalCount);
      setFeedItems((previous) => (append ? [...previous, ...nextResults] : nextResults));
      setCanLoadMoreFeed(page * FEED_PAGE_SIZE < totalCount);
      setFeedPage(page);
    } catch (error) {
      showToast(getFriendlyErrorMessage(error), "error");
    } finally {
      setIsLoadingFeed(false);
    }
  };

  useEffect(() => {
    let disposed = false;
    let timeoutId: number | undefined;

    const loadWithPolling = async () => {
      if (!disposed) {
        await loadFeedPage(1, false);
      }
      if (!disposed) {
        timeoutId = window.setTimeout(() => {
          if (document.visibilityState === "visible") {
            void loadWithPolling();
          } else {
            timeoutId = window.setTimeout(() => void loadWithPolling(), 20000);
          }
        }, 60000);
      }
    };

    void loadWithPolling();

    return () => {
      disposed = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmitHazard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedLocation || isSubmitting) {
      return;
    }

    const normalizedDescription = description.trim();
    if (!normalizedDescription) {
      showToast("Моля, добавете описание на опасността.", "info");
      return;
    }

    if (!session) {
      showToast("Моля, влезте в профила си, за да подадете сигнал.", "info");
      router.push("/auth?callbackUrl=/map");
      return;
    }
    if (!googleIdToken) {
      showToast("Сесията е изтекла. Моля, влезте отново.", "error");
      router.push("/auth?callbackUrl=/map");
      return;
    }

    setIsSubmitting(true);

    try {
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

      await apiRequest("/api/hazards/", {
        method: "POST",
        token: googleIdToken,
        body: formData,
      });

      // Reset interaction state and refresh markers after successful submission.
      setSelectedLocation(null);
      setIsAddingMode(false);
      setImageFile(null);
      setMapRefreshTrigger((previous) => previous + 1);
      await loadFeedPage(1, false);
      showToast("Сигналът беше изпратен успешно.", "success");
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        showToast("Сесията е изтекла. Моля, влезте отново.", "error");
        router.push("/auth?callbackUrl=/map");
      } else {
        showToast(getFriendlyErrorMessage(error), "error");
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
          refreshTrigger={mapRefreshTrigger}
          onLoadingChange={setIsLoadingMap}
          onDataSummaryChange={({ officialAlertsCount, successfulSnapshotsCount }) => {
            setHasOfficialAlerts(officialAlertsCount > 0);
            setHasAnyWebcamSnapshot(successfulSnapshotsCount > 0);
          }}
          onHazardsChanged={() => void loadFeedPage(1, false)}
        />
      </div>

      {/* Render floating map filters as a non-blocking top overlay. */}
      <div className="pointer-events-none absolute top-4 left-4 right-4 z-20 flex items-start justify-between gap-3">
        <div className="ui-card pointer-events-auto rounded-2xl p-1.5">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`min-h-10 rounded-xl px-3.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 ${
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
              className={`min-h-10 rounded-xl px-3.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 ${
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
              data-testid="filter-hazards-button"
              className={`min-h-10 rounded-xl px-3.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 ${
                activeFilter === "hazards"
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              ⚠️ Опасности
            </button>
          </div>
        </div>

        <div className="ui-card pointer-events-auto rounded-2xl px-3 py-2">
          {session ? (
            <div className="flex items-center gap-2">
              {session.user?.image ? (
                // Intentionally use native img for external auth avatar URLs.
                // eslint-disable-next-line @next/next/no-img-element
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
                className="ui-btn-neutral min-h-9 rounded-lg px-3 font-medium"
              >
                Изход
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => router.push("/auth?callbackUrl=/map")}
              data-testid="login-button"
              className="ui-btn-primary min-h-10 px-3.5 font-medium"
            >
              Вход с Google
            </button>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-20 z-20 flex w-[min(92vw,34rem)] -translate-x-1/2 flex-col gap-2">
        {isLoadingMap ? (
          <div className="ui-card-soft px-4 py-2 text-center text-sm font-medium text-slate-100">
            Зареждаме картата и слоевете...
          </div>
        ) : null}

        {!isLoadingMap && !hasOfficialAlerts ? (
          <div className="ui-card-soft border-blue-400/40 bg-blue-500/15 px-4 py-2 text-center text-sm font-medium text-blue-100">
            В момента няма активни официални сигнали.
          </div>
        ) : null}

        {!isLoadingMap && !hasAnyWebcamSnapshot ? (
          <div className="ui-card-soft border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-center text-sm font-medium text-emerald-100">
            В момента няма налични кадри от камери.
          </div>
        ) : null}
      </div>

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
        className="absolute right-6 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl text-slate-800 shadow-lg transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
        style={{
          right: "max(1.5rem, calc(env(safe-area-inset-right) + 1rem))",
          bottom: "calc(7rem + env(safe-area-inset-bottom))",
        }}
      >
        🎯
      </button>

      {/* Provide a large floating action button for quick hazard reporting. */}
      <button
        type="button"
        onClick={handleHazardAction}
        data-testid="add-hazard-fab"
        aria-label="Добави сигнал за опасност"
        className="pointer-events-auto absolute right-6 z-20 flex h-16 w-16 items-center justify-center rounded-full bg-red-600 text-3xl text-white shadow-2xl transition-transform hover:bg-red-500 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/80"
        style={{
          right: "max(1.5rem, calc(env(safe-area-inset-right) + 1rem))",
          bottom: "calc(2rem + env(safe-area-inset-bottom))",
        }}
      >
        {isAddingMode ? "✕" : "⚠️"}
      </button>

      {/* Show a mobile-first live feed toggle and bottom sheet above the map. */}
      <button
        type="button"
        onClick={() => setIsFeedOpen((previous) => !previous)}
        className="ui-btn-secondary pointer-events-auto absolute left-6 z-20 px-4 shadow-xl backdrop-blur-md"
        style={{
          left: "max(1.5rem, calc(env(safe-area-inset-left) + 1rem))",
          bottom: "calc(2rem + env(safe-area-inset-bottom))",
        }}
      >
        {isFeedOpen ? "Скрий сигнали" : "Последни сигнали"}
      </button>

      {isFeedOpen && (
        <section
          className="pointer-events-auto absolute z-30 max-h-[45vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-md"
          style={{
            left: "max(1rem, env(safe-area-inset-left))",
            right: "max(1rem, env(safe-area-inset-right))",
            bottom: "calc(6.5rem + env(safe-area-inset-bottom))",
          }}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">Последни сигнали</h3>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
              Общо: {feedCount}
            </span>
          </div>
          <div className="space-y-2">
            {isLoadingFeed ? (
              Array.from({ length: 3 }).map((_, index) => (
                <article
                  key={`map-feed-skeleton-${index}`}
                  className="ui-card-soft animate-pulse"
                >
                  <div className="h-3 w-16 rounded bg-slate-700" />
                  <div className="mt-2 h-3 w-3/4 rounded bg-slate-700" />
                  <div className="mt-2 h-3 w-full rounded bg-slate-700" />
                </article>
              ))
            ) : feedItems.length === 0 ? (
              <p className="text-xs text-slate-300">Няма налични сигнали в момента.</p>
            ) : (
              feedItems.map((item) => (
                <article
                  key={`${item.item_type}-${item.id}`}
                  className="ui-card-soft"
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span
                      className={`ui-chip ${
                        item.item_type === "hazard"
                          ? "bg-red-500/20 text-red-200"
                          : "bg-blue-500/20 text-blue-200"
                      }`}
                    >
                      {item.item_type === "hazard" ? "Потребителски" : "Официален"}
                    </span>
                    <time className="text-xs text-slate-400">
                      {new Date(item.created_at).toLocaleString("bg-BG")}
                    </time>
                  </div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-300">{item.description}</p>
                  <p className="mt-1 text-xs text-slate-300">
                    {item.item_type === "hazard"
                      ? `Подадено от: ${item.author_name || "Анонимен"}`
                      : `Източник: ${item.source || "Официален канал"}`}
                  </p>
                  {item.item_type === "hazard" && item.status ? (
                    <p className="mt-1 text-xs text-slate-300">
                      Статус:{" "}
                      {item.status === "flagged_for_review"
                        ? "Под проверка"
                        : item.status === "resolved_by_author"
                          ? "Затворен от автора"
                          : item.status === "auto_expired"
                            ? "Автоматично архивиран"
                            : "Активен"}
                    </p>
                  ) : null}
                </article>
              ))
            )}
          </div>
          {!isLoadingFeed && canLoadMoreFeed ? (
            <button
              type="button"
              onClick={() => void loadFeedPage(feedPage + 1, true)}
              className="ui-btn-secondary mt-3 w-full"
            >
              Зареди още
            </button>
          ) : null}
        </section>
      )}

      {selectedLocation && (
        <section
          className="fixed bottom-0 left-0 right-0 z-50 max-h-[82vh] overflow-y-auto rounded-t-3xl border-t border-slate-700 bg-slate-900/95 px-6 pt-6 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
          style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        >
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
                className="h-11 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 text-sm text-white focus:border-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
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
                className="w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
              />
            </div>

            <input
              type="file"
              accept="image/*"
              onChange={(event) => setImageFile(event.target.files?.[0] || null)}
              className="w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="h-12 w-full rounded-xl bg-blue-600 text-base font-semibold text-white shadow-lg transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 disabled:cursor-not-allowed disabled:bg-blue-400"
            >
              {isSubmitting ? "Изпращане..." : "Изпрати сигнал"}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
