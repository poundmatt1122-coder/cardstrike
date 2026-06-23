import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CardStrike — Never miss a price drop",
  description:
    "Track sports cards and get an instant strike alert the moment a price falls to your target.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col bg-suns-purple-deep text-white">
          <header className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              <span className="inline-block h-3 w-3 rounded-sm bg-suns-orange" />
              <span className="text-lg">
                Card<span className="text-suns-gold">Strike</span>
              </span>
            </Link>
            <nav className="flex items-center gap-3 text-sm">
              {/* Always render auth buttons so they're visible while Clerk loads */}
              <Show when="signed-in"
                fallback={
                  <>
                    <SignInButton mode="modal">
                      <button className="rounded-full px-4 py-2 font-medium text-white/90 transition-colors hover:text-white">
                        Sign in
                      </button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <button className="rounded-full bg-suns-orange px-4 py-2 font-semibold text-white transition-colors hover:bg-suns-orange-soft">
                        Get started
                      </button>
                    </SignUpButton>
                  </>
                }
              >
                <Link
                  href="/dashboard"
                  className="rounded-full px-4 py-2 font-medium text-white/90 transition-colors hover:text-white"
                >
                  Dashboard
                </Link>
                <UserButton />
              </Show>
            </nav>
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
