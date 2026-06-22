"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";

const FLAT_LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/alerts", label: "Alerts" },
  { href: "/dashboard/grade", label: "Grade a Card" },
  { href: "/dashboard/ticker", label: "Live Deals" },
  { href: "/dashboard/swap", label: "Swap Advisor" },
];

const TRADE_LINKS = [
  { href: "/dashboard/trade", label: "Trade Board" },
  { href: "/dashboard/trade/listings", label: "My Listings" },
  { href: "/dashboard/trade/offers", label: "Offers" },
  { href: "/dashboard/trade/wishlist", label: "Wishlist" },
];

export default function DashNav() {
  const pathname = usePathname();
  const [tradeOpen, setTradeOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isTradeActive = pathname.startsWith("/dashboard/trade");

  function openTrade() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setTradeOpen(true);
  }

  function closeTrade() {
    timeoutRef.current = setTimeout(() => setTradeOpen(false), 120);
  }

  return (
    <div className="border-b border-white/10 bg-suns-purple/30 px-6 overflow-x-auto">
      <nav className="flex gap-1 text-sm min-w-max">
        {FLAT_LINKS.map(({ href, label }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`border-b-2 whitespace-nowrap px-3 py-3 font-medium transition-colors ${
                active
                  ? "border-suns-orange text-white"
                  : "border-transparent text-white/50 hover:border-suns-orange/50 hover:text-white"
              }`}
            >
              {label}
            </Link>
          );
        })}

        {/* Trade dropdown */}
        <div
          className="relative"
          onMouseEnter={openTrade}
          onMouseLeave={closeTrade}
        >
          <button
            onClick={() => setTradeOpen((o) => !o)}
            className={`flex items-center gap-1 border-b-2 whitespace-nowrap px-3 py-3 font-medium transition-colors ${
              isTradeActive
                ? "border-suns-orange text-white"
                : "border-transparent text-white/50 hover:border-suns-orange/50 hover:text-white"
            }`}
          >
            Trade
            <svg
              className={`h-3 w-3 transition-transform ${tradeOpen ? "rotate-180" : ""}`}
              viewBox="0 0 12 12"
              fill="currentColor"
            >
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
          </button>

          {tradeOpen && (
            <div
              className="absolute left-0 top-full z-50 mt-1 w-44 rounded-xl border border-white/10 bg-suns-purple-deep py-1 shadow-xl"
              onMouseEnter={openTrade}
              onMouseLeave={closeTrade}
            >
              {TRADE_LINKS.map(({ href, label }) => {
                const active = href === "/dashboard/trade"
                  ? pathname === "/dashboard/trade"
                  : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setTradeOpen(false)}
                    className={`block px-4 py-2 text-sm transition-colors ${
                      active
                        ? "text-white bg-suns-orange/20"
                        : "text-white/60 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
