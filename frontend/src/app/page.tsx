"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

type FeedItem = {
  item_type: "hazard" | "official_alert";
  id: number;
  title: string;
  description: string;
  source?: string;
  author_name?: string;
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

export default function Home() {
  const { data: session } = useSession();
  const isOnline = useOnlineStatus();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedCount, setFeedCount] = useState(0);
  const [activeHazards, setActiveHazards] = useState(0);
  const [activeOfficialAlerts, setActiveOfficialAlerts] = useState(0);
  const [latestSnapshotAt, setLatestSnapshotAt] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    const loadDashboardData = async () => {
      try {
        // Load feed and health snapshots in parallel for fast dashboard render.
        const [feedResponse, healthResponse] = await Promise.all([
          fetch("http://localhost:8000/api/feed/?page_size=8", {
            signal: abortController.signal,
          }),
          fetch("http://localhost:8000/api/system/health/", {
            signal: abortController.signal,
          }),
        ]);

        if (!feedResponse.ok || !healthResponse.ok) {
          throw new Error("Failed to load dashboard data.");
        }

        const feedData = (await feedResponse.json()) as FeedResponse;
        const healthData = (await healthResponse.json()) as HealthResponse;

        setFeed(feedData.results ?? []);
        setFeedCount(feedData.count ?? 0);
        setActiveHazards(healthData.metrics?.active_hazards ?? 0);
        setActiveOfficialAlerts(healthData.metrics?.active_official_alerts ?? 0);
        setLatestSnapshotAt(healthData.metrics?.latest_webcam_snapshot_at ?? null);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.error("Error while loading home dashboard:", error);
        }
      }
    };

    loadDashboardData();
    const intervalId = window.setInterval(loadDashboardData, 60000);

    return () => {
      abortController.abort();
      window.clearInterval(intervalId);
    };
  }, []);

  const greeting = useMemo(
    () => (session?.user?.name ? `Здравей, ${session.user.name}` : "Добре дошли"),
    [session?.user?.name],
  );

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto w-full max-w-md px-4 pb-8 pt-6">
        {!isOnline ? (
          <div className="mb-4 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-200">
            Няма връзка с интернет. Показваме последно кеширани данни.
          </div>
        ) : null}

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
            <p className="mt-1 text-lg font-bold text-red-300">{activeHazards}</p>
          </article>
          <article className="rounded-2xl border border-slate-700 bg-slate-900/75 p-3">
            <p className="text-[11px] text-slate-400">Официални сигнали</p>
            <p className="mt-1 text-lg font-bold text-blue-300">{activeOfficialAlerts}</p>
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
            {feed.length === 0 ? (
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
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
