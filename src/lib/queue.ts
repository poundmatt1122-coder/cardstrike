import { Queue, type JobsOptions } from "bullmq";
import { redis } from "@/lib/redis";

/** Canonical queue names — shared by producers (web) and the worker. */
export const QUEUE_NAMES = {
  priceCheck: "price-check",
  notifications: "notifications",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// --- Job payload contracts --------------------------------------------------

/** Fetch the latest market price for a card and evaluate its watches. */
export interface PriceCheckJob {
  /** Omit to scan all active watches (used by the repeatable scheduler job). */
  cardId?: string;
  /** Where the price came from, for snapshot bookkeeping. */
  source?: string;
}

/** Deliver a notification that was queued by the price-check evaluation. */
export interface NotificationJob {
  notificationId: string;
}

export interface JobDataMap {
  [QUEUE_NAMES.priceCheck]: PriceCheckJob;
  [QUEUE_NAMES.notifications]: NotificationJob;
}

// --- Producer-side queue singletons -----------------------------------------

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { age: 3_600, count: 1_000 },
  removeOnFail: { age: 24 * 3_600 },
};

const globalForQueues = globalThis as unknown as {
  queues: Map<QueueName, Queue> | undefined;
};

const queues = globalForQueues.queues ?? new Map<QueueName, Queue>();
if (process.env.NODE_ENV !== "production") {
  globalForQueues.queues = queues;
}

/** Get (or lazily create) the typed Queue for a given name. */
export function getQueue<N extends QueueName>(name: N): Queue<JobDataMap[N]> {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, { connection: redis, defaultJobOptions });
    queues.set(name, queue);
  }
  return queue as Queue<JobDataMap[N]>;
}

/** Convenience helpers for the two queues. */
export const priceCheckQueue = () => getQueue(QUEUE_NAMES.priceCheck);
export const notificationsQueue = () => getQueue(QUEUE_NAMES.notifications);
