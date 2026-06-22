/**
 * Fair-value calculator.
 *
 * Primary source: 90-day median of PriceSnapshot records.
 * Fallback: live eBay Browse API listings when fewer than 3 snapshots exist.
 */

import { prisma } from "@/lib/prisma";
import { searchCardListings } from "@/lib/ebay";

export interface FairValueResult {
  /** Median fair value in cents. */
  fairValue: number;
  /** Number of data points used. */
  dataPoints: number;
  /** 0–1 confidence score based on data density. */
  confidence: number;
  lastUpdated: Date;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function confidenceFromCount(count: number): number {
  if (count >= 10) return 0.9;
  if (count >= 5) return 0.75;
  if (count >= 3) return 0.6;
  return 0.3;
}

/**
 * Returns a fair-value estimate for a card identified by name and grade.
 *
 * @param cardName   Player + set name, e.g. "Victor Wembanyama 2023-24 Prizm Silver RC".
 * @param grade      Condition string, e.g. "PSA 10".
 */
export async function getFairValue(
  cardName: string,
  grade: string,
): Promise<FairValueResult> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // --- Try DB snapshots first --------------------------------------------------
  // Find cards that match by name (case-insensitive contains match).
  const cards = await prisma.card.findMany({
    where: { name: { contains: cardName, mode: "insensitive" } },
    select: { id: true },
  });

  if (cards.length > 0) {
    const cardIds = cards.map((c) => c.id);
    const snapshots = await prisma.priceSnapshot.findMany({
      where: {
        cardId: { in: cardIds },
        capturedAt: { gte: cutoff },
      },
      select: { price: true, capturedAt: true },
      orderBy: { capturedAt: "desc" },
    });

    if (snapshots.length >= 3) {
      const prices = snapshots.map((s) => s.price);
      return {
        fairValue: median(prices),
        dataPoints: snapshots.length,
        confidence: confidenceFromCount(snapshots.length),
        lastUpdated: snapshots[0].capturedAt,
      };
    }
  }

  // --- Fallback: seed from eBay live listings ----------------------------------
  try {
    const listings = await searchCardListings(cardName, grade, 0);
    if (listings.length === 0) {
      return {
        fairValue: 0,
        dataPoints: 0,
        confidence: 0,
        lastUpdated: new Date(),
      };
    }

    const prices = listings.map((l) => l.price).filter((p) => p > 0);
    const fv = median(prices);

    // Persist eBay snapshots for the first matching card so future calls use DB.
    if (cards.length > 0) {
      const cardId = cards[0].id;
      await prisma.priceSnapshot.createMany({
        data: listings.slice(0, 20).map((l) => ({
          cardId,
          price: l.price,
          currency: l.currency,
          source: "ebay-browse",
          capturedAt: new Date(),
        })),
        skipDuplicates: true,
      });
    }

    return {
      fairValue: fv,
      dataPoints: prices.length,
      confidence: confidenceFromCount(prices.length),
      lastUpdated: new Date(),
    };
  } catch {
    return {
      fairValue: 0,
      dataPoints: 0,
      confidence: 0,
      lastUpdated: new Date(),
    };
  }
}
