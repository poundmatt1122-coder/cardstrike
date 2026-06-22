// Load .env.local before anything reads process.env.
import "@/lib/env";

import crypto from "node:crypto";
import { Worker, Queue, type Job } from "bullmq";
import { createRedisConnection, redis } from "@/lib/redis";
import {
  QUEUE_NAMES,
  type NotificationJob,
  type PriceCheckJob,
} from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { searchCardListings } from "@/lib/ebay";
import { getFairValue } from "@/lib/fairValue";
import { sendAlertEmail } from "@/lib/email";

const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 5);

// Discount threshold: alert when listing is at least 10% below fair value.
const DISCOUNT_THRESHOLD = 0.1;
const DEDUP_TTL_SECONDS = 24 * 60 * 60; // 24 hours

// ---------------------------------------------------------------------------
// Deduplication helpers (Redis-backed)
// ---------------------------------------------------------------------------

function dedupKey(userId: string, listingUrl: string): string {
  const hash = crypto.createHash("sha1").update(listingUrl).digest("hex").slice(0, 16);
  return `dedup:${userId}:${hash}`;
}

async function isDuplicate(userId: string, listingUrl: string): Promise<boolean> {
  const key = dedupKey(userId, listingUrl);
  const exists = await redis.exists(key);
  return exists === 1;
}

async function markSent(userId: string, listingUrl: string): Promise<void> {
  const key = dedupKey(userId, listingUrl);
  await redis.set(key, "1", "EX", DEDUP_TTL_SECONDS);
}

// ---------------------------------------------------------------------------
// Price-check processor
// ---------------------------------------------------------------------------

async function processPriceCheck(job: Job<PriceCheckJob>): Promise<void> {
  const { cardId, source } = job.data;

  // When no cardId is supplied this is a scan-all job.
  const watches = await prisma.watch.findMany({
    where: {
      status: "ACTIVE",
      ...(cardId ? { cardId } : {}),
    },
    include: {
      card: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });

  console.log(`[price-check] ${watches.length} active watch(es) to evaluate (source: ${source ?? "scheduler"})`);

  for (const watch of watches) {
    const card = watch.card;
    const cardName = `${card.player} ${card.name}`;
    const grade = card.condition;

    // 1. Get fair value.
    let fvResult;
    try {
      fvResult = await getFairValue(cardName, grade);
    } catch (err) {
      console.error(`[price-check] fair-value error for ${cardId}:`, err);
      continue;
    }

    if (fvResult.fairValue === 0) continue;

    // 2. Search live listings.
    let listings;
    try {
      listings = await searchCardListings(cardName, grade, 0);
    } catch (err) {
      console.error(`[price-check] eBay search error for ${cardName}:`, err);
      continue;
    }

    // 3. Persist price snapshot from first listing.
    if (listings.length > 0) {
      const latestPrice = listings[0].price;
      await prisma.priceSnapshot.create({
        data: {
          cardId: card.id,
          price: latestPrice,
          currency: listings[0].currency,
          source: "ebay-browse",
        },
      });
      await prisma.card.update({
        where: { id: card.id },
        data: { lastPrice: latestPrice },
      });
    }

    // 4. Find deals that beat the threshold.
    const threshold = fvResult.fairValue * (1 - DISCOUNT_THRESHOLD);

    for (const listing of listings) {
      if (listing.price === 0 || listing.price >= threshold) continue;
      if (await isDuplicate(watch.user.id, listing.url)) continue;

      const discountPct = Math.round(
        ((fvResult.fairValue - listing.price) / fvResult.fairValue) * 100,
      );

      // 5. Persist notification record.
      const bodyJson = JSON.stringify({
        listingUrl: listing.url,
        listingPrice: listing.price,
        fairValue: fvResult.fairValue,
        discountPct,
        cardName,
        grade,
      });

      const notification = await prisma.notification.create({
        data: {
          userId: watch.user.id,
          watchId: watch.id,
          channel: "EMAIL",
          status: "PENDING",
          subject: `⚡ CardStrike Alert — ${cardName} is ${discountPct}% below market`,
          body: bodyJson,
        },
      });

      // 6. Enqueue notification delivery.
      const notifQueue = new Queue(QUEUE_NAMES.notifications, { connection: createRedisConnection() });
      await notifQueue.add("send", { notificationId: notification.id });
      await notifQueue.close();

      await markSent(watch.user.id, listing.url);
      console.log(`[price-check] queued notification ${notification.id} — ${discountPct}% deal on ${cardName}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Notification processor
// ---------------------------------------------------------------------------

async function processNotification(job: Job<NotificationJob>): Promise<void> {
  const { notificationId } = job.data;
  console.log(`[notifications] sending notification ${notificationId}`);

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    include: { user: true },
  });

  if (!notification) {
    console.warn(`[notifications] notification ${notificationId} not found`);
    return;
  }

  // Parse the body JSON written by the price-check processor.
  let body: {
    listingUrl: string;
    listingPrice: number;
    fairValue: number;
    discountPct: number;
    cardName: string;
    grade: string;
  };

  try {
    body = JSON.parse(notification.body) as typeof body;
  } catch {
    console.error(`[notifications] malformed body for ${notificationId}`);
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: "FAILED" },
    });
    return;
  }

  try {
    await sendAlertEmail({
      toEmail: notification.user.email,
      toName: notification.user.name,
      cardName: body.cardName,
      grade: body.grade,
      listingPrice: body.listingPrice,
      fairValue: body.fairValue,
      discountPct: body.discountPct,
      listingUrl: body.listingUrl,
    });

    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: "SENT", sentAt: new Date() },
    });

    console.log(`[notifications] sent ${notificationId}`);
  } catch (err) {
    console.error(`[notifications] failed to send ${notificationId}:`, err);
    await prisma.notification.update({
      where: { id: notificationId },
      data: { status: "FAILED" },
    });
    throw err; // BullMQ will retry per job options.
  }
}

// ---------------------------------------------------------------------------
// Worker wiring
// ---------------------------------------------------------------------------

function startWorker<T>(
  name: string,
  processor: (job: Job<T>) => Promise<void>,
): Worker<T> {
  const worker = new Worker<T>(name, processor, {
    connection: createRedisConnection(),
    concurrency,
  });

  worker.on("completed", (job) => {
    console.log(`[${name}] job ${job.id} completed`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[${name}] job ${job?.id} failed:`, err.message);
  });
  worker.on("error", (err) => {
    console.error(`[${name}] worker error:`, err);
  });

  return worker;
}

const workers: Worker[] = [
  startWorker(QUEUE_NAMES.priceCheck, processPriceCheck),
  startWorker(QUEUE_NAMES.notifications, processNotification),
];

// ---------------------------------------------------------------------------
// Schedule repeatable scan-all price-check every 5 minutes.
// ---------------------------------------------------------------------------

async function scheduleRepeatingJobs() {
  const priceCheckQueue = new Queue(QUEUE_NAMES.priceCheck, {
    connection: createRedisConnection(),
  });

  await priceCheckQueue.add(
    "scan-all",
    { source: "scheduler" },
    { repeat: { every: 5 * 60 * 1000 } },
  );

  await priceCheckQueue.close();
  console.log("[scheduler] scan-all price-check repeatable job registered (every 5 min)");
}

void scheduleRepeatingJobs();

console.log(
  `CardStrike worker up — queues: ${Object.values(QUEUE_NAMES).join(", ")} (concurrency ${concurrency})`,
);

// ---------------------------------------------------------------------------
// Graceful shutdown so in-flight jobs finish and connections close cleanly.
// ---------------------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  console.log(`\nReceived ${signal}, draining workers...`);
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
