/**
 * PriceCharting.com API client.
 *
 * Free, no-key API at https://www.pricecharting.com/api/products
 * Returns aggregate market prices (ungraded + PSA/BGS grades 1-10).
 *
 * searchCardListings() maps each matching product × grade tier to a
 * CardListing so callers get a price array to median over, exactly as
 * the old eBay Browse integration did.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardListing {
  title: string;
  price: number; // cents
  currency: string;
  url: string;
  imageUrl: string | null;
  condition: string;
  seller: string;
  endTime: string | null;
}

// Alias so any code that still references EbayListing compiles unchanged.
export type EbayListing = CardListing;

interface PCProduct {
  id: string | number;
  "product-name"?: string;
  "console-name"?: string;
  "loose-price"?: number | null;
  "graded-price"?: number | null;
  "grade-1-price"?: number | null;
  "grade-2-price"?: number | null;
  "grade-3-price"?: number | null;
  "grade-4-price"?: number | null;
  "grade-5-price"?: number | null;
  "grade-6-price"?: number | null;
  "grade-7-price"?: number | null;
  "grade-8-price"?: number | null;
  "grade-9-price"?: number | null;
  "grade-10-price"?: number | null;
}

interface PCSearchResponse {
  status: string;
  products?: PCProduct[];
}

const BASE_URL = "https://www.pricecharting.com/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the integer grade from a string like "PSA 10", "BGS 9.5", "10".
 * Returns null if no grade number is found.
 */
function parseGradeNumber(grade: string): number | null {
  const match = grade.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const n = Math.round(parseFloat(match[1]));
  return n >= 1 && n <= 10 ? n : null;
}

/**
 * Pick the most relevant price from a product for a given grade tier.
 * Falls back through: grade-N-price → graded-price → loose-price.
 */
function priceForGrade(product: PCProduct, gradeNum: number | null): number {
  if (gradeNum !== null) {
    const key = `grade-${gradeNum}-price` as keyof PCProduct;
    const val = product[key];
    if (typeof val === "number" && val > 0) return val;
    // Fall through to graded aggregate.
    if (typeof product["graded-price"] === "number" && product["graded-price"] > 0) {
      return product["graded-price"];
    }
  }
  return typeof product["loose-price"] === "number" ? (product["loose-price"] ?? 0) : 0;
}

function productUrl(product: PCProduct, fallbackQuery: string): string {
  const name = product["product-name"] ?? fallbackQuery;
  return `https://www.pricecharting.com/search-products?q=${encodeURIComponent(name)}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search PriceCharting for trading-card price data matching cardName + gradeMin.
 *
 * Each matching product is returned as a CardListing whose price reflects the
 * requested grade tier (or the ungraded market price when no grade is given).
 *
 * @param cardName   Free-text search, e.g. "Victor Wembanyama 2023-24 Prizm Silver RC".
 * @param gradeMin   Grade filter, e.g. "PSA 10" or "". Parsed to an integer grade level.
 * @param maxPrice   Upper price cap in cents; pass 0 to omit.
 */
export async function searchCardListings(
  cardName: string,
  gradeMin: string,
  maxPrice: number,
): Promise<CardListing[]> {
  const query = gradeMin ? `${cardName} ${gradeMin}` : cardName;

  const res = await fetch(
    `${BASE_URL}/products?q=${encodeURIComponent(query)}&status=price-guide`,
    { headers: { "User-Agent": "CardStrike/1.0" } },
  );

  if (!res.ok) {
    throw new Error(`PriceCharting API error (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as PCSearchResponse;
  if (data.status !== "success" || !Array.isArray(data.products)) return [];

  const gradeNum = parseGradeNumber(gradeMin);
  const condition = gradeMin || "Ungraded";

  const listings: CardListing[] = data.products
    .map((product): CardListing => {
      const price = priceForGrade(product, gradeNum);
      const consoleName = product["console-name"];
      const title = consoleName
        ? `${product["product-name"] ?? ""} — ${consoleName}`
        : (product["product-name"] ?? cardName);

      return {
        title,
        price,
        currency: "USD",
        url: productUrl(product, cardName),
        imageUrl: null,
        condition,
        seller: "PriceCharting",
        endTime: null,
      };
    })
    .filter((l) => l.price > 0)
    .filter((l) => maxPrice === 0 || l.price <= maxPrice);

  return listings;
}
