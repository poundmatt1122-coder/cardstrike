import { redis } from "@/lib/redis";

export async function rateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const current = await redis.incr(key);
  if (current === 1) await redis.expire(key, windowSeconds);
  return {
    allowed: current <= maxRequests,
    remaining: Math.max(0, maxRequests - current),
  };
}
