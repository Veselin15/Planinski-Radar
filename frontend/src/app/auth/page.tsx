"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function AuthPageContent() {
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
      <div className="ui-card mx-auto w-full max-w-md p-6 sm:p-8">
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
          data-testid="google-signin-button"
          disabled={status === "loading"}
          className="ui-btn-primary mt-6 h-12 w-full gap-2 disabled:cursor-not-allowed disabled:bg-blue-400"
        >
          {status === "loading" ? "Зареждане..." : "Вход с Google"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/map")}
          className="ui-btn-secondary mt-3 w-full bg-transparent font-medium text-slate-200"
        >
          Назад към картата
        </button>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-white">
          <div className="ui-card mx-auto w-full max-w-md p-6 sm:p-8">
            <p className="text-sm text-slate-300">Зареждане на вход...</p>
          </div>
        </main>
      }
    >
      <AuthPageContent />
    </Suspense>
  );
}
