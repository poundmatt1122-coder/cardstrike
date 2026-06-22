/**
 * eBay Browse API client.
 * - OAuth2 client-credentials token, cached in Redis with TTL.
 * - searchCardListings() queries the Browse API filtered to the
 *   Trading Cards category (183050).
 */

import { redis } from "@/lib/redis";

const EBAY_TOKEN_KEY = "ebay:token";
const EBAY_CATEGORY_TRADING_CARDS = "183050";

const BASE_URL =
  process.env.EBAY_ENVIRONMENT === "sandbox"
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com";

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

interface EbayToken {
  access_token: string;
  expires_in: number; // seconds
  token_type: string;
}

async function fetchFreshToken(): Promise<string> {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET.");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${BASE_URL}/identity/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope/buy.item.summary",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`eBay token fetch failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as EbayToken;
  return data.access_token;
}

export async function getEbayToken(): Promise<string> {
  const cached = await redis.get(EBAY_TOKEN_KEY);
  if (cached) return cached;

  const token = await fetchFreshToken();
  // Cache with a 10-minute safety margin (tokens are valid for 2 hours).
  await redis.set(EBAY_TOKEN_KEY, token, "EX", 7200 - 600);
  return token;
}

// ---------------------------------------------------------------------------
// Listing search
// ---------------------------------------------------------------------------

export interface EbayListing {
  title: string;
  price: number; // cents
  currency: string;
  url: string;
  imageUrl: string | null;
  condition: string;
  seller: string;
  endTime: string | null;
}

interface EbayItemSummary {
  title?: string;
  price?: { value?: string; currency?: string };
  itemWebUrl?: string;
  image?: { imageUrl?: string };
  condition?: string;
  seller?: { username?: string };
  itemEndDate?: string;
}

interface EbaySearchResponse {
  total?: number;
  itemSummaries?: EbayItemSummary[];
  errors?: { message: string }[];
}

/**
 * Search eBay active listings for a trading card.
 *
 * @param cardName  Free-text search (player + set name).
 * @param gradeMin  Grade filter appended to query, e.g. "PSA 10".
 * @param maxPrice  Upper price limit in cents; pass 0 to omit.
 */
export async function searchCardListings(
  cardName: string,
  gradeMin: string,
  maxPrice: number,
): Promise<EbayListing[]> {
  const token = await getEbayToken();

  const query = gradeMin ? `${cardName} ${gradeMin}` : cardName;
  const params = new URLSearchParams({
    q: query,
    category_ids: EBAY_CATEGORY_TRADING_CARDS,
    limit: "50",
    sort: "price",
  });

  if (maxPrice > 0) {
    params.set("filter", `price:[..${(maxPrice / 100).toFixed(2)}],priceCurrency:USD`);
  }

  const res = await fetch(
    `${BASE_URL}/buy/browse/v1/item_summary/search?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "Content-Type": "application/json",
      },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`eBay Browse API error (${res.status}): ${text}`);
  }

  const data = (await res.json()) as EbaySearchResponse;

  return (data.itemSummaries ?? []).map((item) => ({
    title: item.title ?? "",
    price: Math.round(parseFloat(item.price?.value ?? "0") * 100),
    currency: item.price?.currency ?? "USD",
    url: item.itemWebUrl ?? "",
    imageUrl: item.image?.imageUrl ?? null,
    condition: item.condition ?? "",
    seller: item.seller?.username ?? "",
    endTime: item.itemEndDate ?? null,
  }));
}
