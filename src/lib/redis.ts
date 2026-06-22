import IORedis, { type RedisOptions } from "ioredis";

/**
 * Shared Redis connection settings for BullMQ.
 *
 * BullMQ workers require `maxRetriesPerRequest: null` so blocking commands
 * (BRPOPLPUSH etc.) aren't aborted by ioredis' retry logic.
 */
const baseOptions: RedisOptions = {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

/** Create a fresh Redis connection (BullMQ wants distinct connections). */
export function createRedisConnection(): IORedis {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("Missing required environment variable \"REDIS_URL\".");
  }
  return new IORedis(url, baseOptions);
}

// Reuse a single connection for producers (enqueueing from the web app).
const globalForRedis = globalThis as unknown as {
  redis: IORedis | undefined;
};

export const redis = globalForRedis.redis ?? createRedisConnection();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
