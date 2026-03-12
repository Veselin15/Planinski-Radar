"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useToast } from "../components/ToastProvider";
import { apiRequest, getFriendlyErrorMessage } from "../lib/api";

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

type FeedResponse = {
  count: number;
  results: FeedItem[];
};

type HealthResponse = {
  metrics?: {
    active_hazards?: number;
    active_official_alerts?: number;
    latest_webcam_snapshot_at?: string | null;
  };
};

const FEED_PAGE_SIZE = 6;

export default function Home() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedCount, setFeedCount] = useState(0);
  const [feedPage, setFeedPage] = useState(1);
  const [canLoadMoreFeed, setCanLoadMoreFeed] = useState(false);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [activeHazards, setActiveHazards] = useState(0);
  const [activeOfficialAlerts, setActiveOfficialAlerts] = useState(0);
  const [latestSnapshotAt, setLatestSnapshotAt] = useState<string | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(true);

  useEffect(() => {
    let isDisposed = false;
    let timeoutId: number | undefined;

    const loadHealthData = async () => {
      try {
        const healthData = await apiRequest<HealthResponse>("/api/system/health/");
        if (!isDisposed) {
          setActiveHazards(healthData.metrics?.active_hazards ?? 0);
          setActiveOfficialAlerts(healthData.metrics?.active_official_alerts ?? 0);
          setLatestSnapshotAt(healthData.metrics?.latest_webcam_snapshot_at ?? null);
          setIsLoadingHealth(false);
        }
      } catch (error) {
        if (
          !isDisposed &&
          !(error instanceof DOMException && error.name === "AbortError")
        ) {
          showToast(getFriendlyErrorMessage(error), "error");
          setIsLoadingHealth(false);
        }
      } finally {
        if (!isDisposed) {
          timeoutId = window.setTimeout(() => {
            if (document.visibilityState === "visible") {
              void loadHealthData();
            } else {
              timeoutId = window.setTimeout(() => void loadHealthData(), 20000);
            }
          }, 60000);
        }
      }
    };

    void loadHealthData();

    return () => {
      isDisposed = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [showToast]);

  const loadFeedPage = async (page: number, append: boolean) => {
    try {
      setIsLoadingFeed(true);
      const feedData = await apiRequest<FeedResponse>(
        `/api/feed/?page=${page}&page_size=${FEED_PAGE_SIZE}`,
      );
      const totalCount = feedData.count ?? 0;
      setFeedCount(totalCount);
      setFeed((previousFeed) =>
        append ? [...previousFeed, ...(feedData.results ?? [])] : feedData.results ?? [],
      );
      setCanLoadMoreFeed(page * FEED_PAGE_SIZE < totalCount);
      setFeedPage(page);
    } catch (error) {
      showToast(getFriendlyErrorMessage(error), "error");
    } finally {
      setIsLoadingFeed(false);
    }
  };

  useEffect(() => {
    void loadFeedPage(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const greeting = useMemo(
    () => (session?.user?.name ? `Здравей, ${session.user.name}` : "Добре дошли"),
    [session?.user?.name],
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto w-full max-w-md px-4 pb-8 pt-6">
        <header className="mb-5 rounded-3xl border border-slate-700 bg-slate-900/80 p-4 shadow-xl backdrop-blur-md">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Планински Радар
          </p>
          <h1 className="mt-1 text-xl font-bold">{greeting}</h1>
          <p className="mt-1 text-sm text-slate-300">
            Мобилен център за сигнали, официални бюлетини и условия в планината.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link
              href="/map"
              className="flex h-11 items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Отвори карта
            </Link>
            <Link
              href="/auth?callbackUrl=/map"
              className="flex h-11 items-center justify-center rounded-xl border border-slate-600 bg-slate-800 text-sm font-semibold text-slate-200 transition hover:bg-slate-700"
            >
              Вход / Профил
            </Link>
          </div>
        </header>

        <section className="mb-5 grid grid-cols-2 gap-2">
          <article className="rounded-2xl border border-slate-700 bg-slate-900/75 p-3">
            <p className="text-[11px] text-slate-400">Активни опасности</p>
            <p className="mt-1 text-lg font-bold text-red-300">
              {isLoadingHealth ? "..." : activeHazards}
            </p>
          </article>
          <article className="rounded-2xl border border-slate-700 bg-slate-900/75 p-3">
            <p className="text-[11px] text-slate-400">Официални сигнали</p>
            <p className="mt-1 text-lg font-bold text-blue-300">
              {isLoadingHealth ? "..." : activeOfficialAlerts}
            </p>
          </article>
          <article className="col-span-2 rounded-2xl border border-slate-700 bg-slate-900/75 p-3">
            <p className="text-[11px] text-slate-400">Последен webcam cache</p>
            <p className="mt-1 text-sm font-semibold text-slate-200">
              {latestSnapshotAt
                ? new Date(latestSnapshotAt).toLocaleString("bg-BG")
                : "Все още няма кеширани кадри"}
            </p>
          </article>
        </section>

        <section className="rounded-3xl border border-slate-700 bg-slate-900/80 p-4 shadow-xl backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Последни сигнали</h2>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
              Общо: {feedCount}
            </span>
          </div>

          <div className="space-y-2">
            {isLoadingFeed ? (
              Array.from({ length: 3 }).map((_, index) => (
                <article
                  key={`feed-skeleton-${index}`}
                  className="animate-pulse rounded-xl border border-slate-700 bg-slate-800/80 p-2.5"
                >
                  <div className="h-3 w-20 rounded bg-slate-700" />
                  <div className="mt-2 h-3 w-3/4 rounded bg-slate-700" />
                  <div className="mt-2 h-3 w-full rounded bg-slate-700" />
                </article>
              ))
            ) : feed.length === 0 ? (
              <p className="text-xs text-slate-400">
                Няма налични записи. Провери отново след няколко минути.
              </p>
            ) : (
              feed.map((item) => (
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
                  {item.item_type === "hazard" && item.status ? (
                    <p className="mt-1 text-[11px] text-slate-400">
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
              className="mt-3 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-700"
            >
              Зареди още
            </button>
          ) : null}
        </section>
      </div>
    </main>
  );
}
