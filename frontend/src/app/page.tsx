"use client";

import { FormEvent, useState } from "react";

type FeatureCardProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

function FeatureCard({ title, description, icon }: FeatureCardProps) {
  return (
    <article className="rounded-2xl border border-blue-100 bg-white/90 p-6 shadow-sm backdrop-blur">
      <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-100 to-blue-100 text-blue-700">
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="text-sm leading-6 text-slate-600">{description}</p>
    </article>
  );
}

export default function Home() {
  const [email, setEmail] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return;
    }

    // Temporary behavior until backend integration is added.
    console.log("Ранен абонамент:", trimmedEmail);
    setEmail("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 via-sky-50 to-white text-slate-900">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-8 sm:px-6 sm:py-12 lg:gap-20 lg:px-8">
        <section className="rounded-3xl border border-green-100 bg-white/85 p-6 shadow-xl shadow-sky-100/60 backdrop-blur sm:p-10">
          <span className="mb-5 inline-flex items-center rounded-full border border-green-200 bg-green-100 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-green-800 sm:text-sm">
            В разработка / Очаквайте скоро
          </span>

          <div className="max-w-3xl">
            <h1 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Планински Радар
            </h1>
            <p className="mt-4 text-xl font-medium text-sky-900 sm:text-2xl">
              Твоят дигитален пазител за безопасност в планината.
            </p>
            <p className="mt-5 text-base leading-7 text-slate-700 sm:text-lg">
              Създаваме динамична топографска карта, която комбинира сигнали от
              общността за реални рискове по маршрутите с официални данни от
              планинските служби. На едно място ще виждаш и актуални бюлетини,
              и живи уебкамери за по-уверени решения преди и по време на преход.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 sm:text-sm">
              Официални сигнали
            </span>
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 sm:text-sm">
              Общностни доклади
            </span>
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 sm:text-sm">
              Рискови зони и инциденти
            </span>
          </div>
        </section>

        <section aria-labelledby="features-heading" className="space-y-6">
          <div className="max-w-2xl">
            <h2
              id="features-heading"
              className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl"
            >
              Основни възможности
            </h2>
            <p className="mt-2 text-slate-600">
              Всичко важно за условията в планината, подредено ясно и достъпно
              директно от телефона ти.
            </p>
          </div>

          <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
            <FeatureCard
              title="Карта на опасностите"
              description="Подавай и преглеждай сигнали за лавини, лед, паднали дървета и други рискове, за да планираш по-безопасен маршрут."
              icon={
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M3 7.5 12 3l9 4.5-9 4.5L3 7.5Z" />
                  <path d="M3 12l9 4.5 9-4.5" />
                  <path d="M3 16.5 12 21l9-4.5" />
                </svg>
              }
            />
            <FeatureCard
              title="Официални бюлетини"
              description="Автоматично събиране на предупреждения от ПСС и паркови институции за актуална и надеждна картина на ситуацията."
              icon={
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M12 3v18" />
                  <path d="M5.5 8.5h13l-2 4h-9l-2-4Z" />
                  <path d="M7 21h10" />
                </svg>
              }
            />
            <FeatureCard
              title="Хижи и Уебкамери"
              description="Провери условията около хижите с последни кадри от уебкамери и допълнителни метео индикатори преди тръгване."
              icon={
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <rect x="3.5" y="6" width="17" height="12" rx="2" />
                  <path d="m9 12 2 2 4-4" />
                  <path d="M8 3h8" />
                </svg>
              }
            />
          </div>
        </section>

        <section className="rounded-3xl border border-blue-100 bg-white p-6 shadow-lg shadow-blue-100/60 sm:p-8">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold text-slate-950 sm:text-3xl">
              Бъди сред първите, които ще тестват приложението.
            </h2>
            <p className="mt-2 text-slate-600">
              Запиши се за ранна бета и получавай първи достъп до новите
              функционалности.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <label htmlFor="email" className="sr-only">
              Твоят имейл адрес
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Твоят имейл адрес"
              className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:flex-1"
            />
            <button
              type="submit"
              className="inline-flex h-12 min-w-36 items-center justify-center rounded-xl bg-gradient-to-r from-green-600 to-blue-600 px-6 text-base font-semibold text-white transition hover:from-green-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
            >
              Запиши се
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-green-100 bg-gradient-to-r from-green-50 to-blue-50 p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-slate-950 sm:text-3xl">
            Проектът е безплатен и отворен.
          </h2>
          <p className="mt-3 max-w-3xl text-slate-700">
            Планински Радар ще остане безплатен и с отворен код, без реклами и
            скрити такси. Поддръжката на специализирана инфраструктура за
            обработка на данни и актуализации в реално време обаче изисква
            постоянни разходи. Ако искаш да помогнеш за поддръжката, можеш да
            ме подкрепиш тук:
          </p>
          <a
            href="https://www.buymeacoffee.com/"
            target="_blank"
            rel="noreferrer noopener"
            className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-offset-2"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-5 w-5 text-amber-600"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M7 5h9v9a4 4 0 0 1-4 4h-1a4 4 0 0 1-4-4V5Z" />
              <path d="M16 8h2a2 2 0 1 1 0 4h-2" />
              <path d="M6 21h12" />
            </svg>
            Подкрепи развитието
          </a>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white/80 px-4 py-5 text-center text-sm text-slate-600 sm:px-6">
        © {new Date().getFullYear()} Планински Радар
      </footer>
    </div>
  );
}
