/**
 * Loads environment variables for non-Next.js runtimes (e.g. the BullMQ
 * worker started via `tsx`). Next.js loads `.env.local` on its own, so this
 * is a no-op there — importing it is harmless and keeps the worker honest.
 *
 * Import this FIRST in any standalone entrypoint, before modules that read
 * `process.env` at import time (Prisma, Redis, Resend).
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"] });

/** Read a required env var, throwing a clear error if it's missing. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". Add it to .env.local.`,
    );
  }
  return value;
}
