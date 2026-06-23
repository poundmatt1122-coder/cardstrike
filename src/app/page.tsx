import Link from "next/link";
import { Show, SignUpButton } from "@clerk/nextjs"; // Show used for signed-in dashboard link

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Suns-themed gradient backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-suns-purple-deep via-suns-purple to-suns-purple-soft"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 h-[36rem] w-[36rem] rounded-full bg-suns-orange/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-48 -left-40 h-[32rem] w-[32rem] rounded-full bg-suns-gold/20 blur-3xl"
      />

      <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-suns-gold/40 bg-suns-gold/10 px-4 py-1.5 text-sm font-medium text-suns-gold">
          <span className="h-2 w-2 animate-pulse rounded-full bg-suns-gold" />
          Live price-drop alerts for collectors
        </span>

        <h1 className="max-w-3xl text-balance text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          Never miss the{" "}
          <span className="bg-gradient-to-r from-suns-orange to-suns-gold bg-clip-text text-transparent">
            strike price
          </span>{" "}
          on a card again.
        </h1>

        <p className="max-w-xl text-balance text-lg leading-8 text-white/70">
          CardStrike watches the market around the clock and pings you the
          instant a card you want drops to your target. Set it once — we&apos;ll
          do the chasing.
        </p>

        <div className="flex flex-col items-center gap-4 sm:flex-row">
          {/* SignUpButton is always rendered so it's visible even while Clerk loads */}
          <SignUpButton mode="modal">
            <button className="h-12 rounded-full bg-suns-orange px-8 text-base font-semibold text-white shadow-lg shadow-suns-orange/30 transition-colors hover:bg-suns-orange-soft">
              Start tracking free
            </button>
          </SignUpButton>
          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="flex h-12 items-center rounded-full bg-suns-orange px-8 text-base font-semibold text-white shadow-lg shadow-suns-orange/30 transition-colors hover:bg-suns-orange-soft"
            >
              Go to dashboard
            </Link>
          </Show>
          <a
            href="#how-it-works"
            className="flex h-12 items-center rounded-full border border-white/20 px-8 text-base font-medium text-white/90 transition-colors hover:border-white/40 hover:bg-white/5"
          >
            How it works
          </a>
        </div>

        <dl
          id="how-it-works"
          className="mt-12 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3"
        >
          {[
            {
              step: "01",
              title: "Pick your cards",
              body: "Add any card and the condition you're hunting for.",
            },
            {
              step: "02",
              title: "Set a strike price",
              body: "Tell us the price you'd happily pay.",
            },
            {
              step: "03",
              title: "Get the alert",
              body: "We ping you the moment the market drops to it.",
            },
          ].map((f) => (
            <div
              key={f.step}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur-sm"
            >
              <dt className="text-sm font-bold text-suns-gold">{f.step}</dt>
              <dd className="mt-2">
                <p className="font-semibold text-white">{f.title}</p>
                <p className="mt-1 text-sm text-white/60">{f.body}</p>
              </dd>
            </div>
          ))}
        </dl>
      </main>
    </div>
  );
}
