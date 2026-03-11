"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function AuthPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/map";

  useEffect(() => {
    // Redirect authenticated users away from the auth page.
    if (session) {
      router.replace(callbackUrl);
    }
  }, [session, callbackUrl, router]);

  const handleGoogleAuth = async () => {
    // Start OAuth flow and return user back to requested page.
    await signIn("google", { callbackUrl });
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-2xl backdrop-blur-md sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
          Планински Радар
        </p>
        <h1 className="mt-2 text-2xl font-bold">Вход / Регистрация</h1>
        <p className="mt-2 text-sm text-slate-300">
          Влезте с Google, за да подавате сигнали, да потвърждавате опасности и да
          изградим по-надеждна общностна карта.
        </p>

        <button
          type="button"
          onClick={handleGoogleAuth}
          disabled={status === "loading"}
          className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {status === "loading" ? "Зареждане..." : "Вход с Google"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/map")}
          className="mt-3 h-11 w-full rounded-xl border border-slate-600 bg-transparent px-4 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
        >
          Назад към картата
        </button>
      </div>
    </main>
  );
}
