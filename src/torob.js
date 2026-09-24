const API = "https://api.torob.com";
const SITE = "https://torob.com";
const UA = "torob-mcp/0.1 (+read-only price comparison)";

const cache = new Map();
const CACHE_MS = 3 * 60 * 1000;
let lastCall = 0;
const GAP_MS = 400;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function faToEn(s) {
  return String(s).replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d));
}

export function shopCount(text) {
  if (!text || typeof text !== "string") return null;
  const m = faToEn(text).match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

export function productUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return SITE + path;
}

export function card(item) {
  if (!item || !item.random_key) return null;
  const price = typeof item.price === "number" && item.price > 0 ? item.price : null;
  const inStock = item.price_text_mode !== "disabled" && price != null;
  return {
    id: item.random_key,
    title: item.name1 ?? null,
    title_en: item.name2 || null,
    price_toman: price,
    price_label: item.price_text || null,
    in_stock: inStock,
    shop_count: shopCount(item.shop_text),
    shop_text: item.shop_text || null,
    url: productUrl(item.web_client_absolute_url),
    image_url: item.image_url || null,
    is_ad: item.is_adv === true,
  };
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.exp) {
    cache.delete(key);
    return null;
  }
  return hit.value;
}

export async function torobGet(path, params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    q.set(k, String(v));
  }
  const url = path.startsWith("http") ? path : `${API}${path}${q.toString() ? `?${q}` : ""}`;
  const cached = cacheGet(url);
  if (cached) return cached;

  const wait = GAP_MS - (Date.now() - lastCall);
  if (wait > 0) await sleep(wait);

  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    lastCall = Date.now();
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": UA },
    });
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`Torob returned HTTP ${res.status}`);
      await sleep(800 * 2 ** attempt);
      continue;
    }
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Torob HTTP ${res.status}: ${body.slice(0, 180)}`);
    }
    const json = await res.json();
    cache.set(url, { exp: Date.now() + CACHE_MS, value: json });
    return json;
  }
  throw lastErr ?? new Error("Torob request failed");
}

const SORTS = {
  popular: "",
  cheapest: "price",
  expensive: "-price",
  newest: "-date",
  most_sellers: "-supply",
};

export function sortParam(sort) {
  if (!sort || sort === "popular") return undefined;
  if (!(sort in SORTS)) {
    throw new Error(`Unknown sort "${sort}". Use popular, cheapest, expensive, newest, most_sellers.`);
  }
  return SORTS[sort];
}

export async function searchProducts(opts) {
  const limit = clamp(opts.limit, 10, 1, 24);
  const page = clamp(opts.page, 1, 1, 50);
  const params = {
    q: opts.query,
    category: opts.category_id,
    brand: opts.brand_id,
    page: page - 1,
    size: limit,
    sort: sortParam(opts.sort),
    available: opts.only_marketable === false ? undefined : "true",
  };
  if (opts.min_price_toman != null) params.price__gt = opts.min_price_toman;
  if (opts.max_price_toman != null) params.price__lt = opts.max_price_toman;
  const data = await torobGet("/v4/base-product/search/", params);
  let items = (data.results ?? []).map(card).filter(Boolean);
  if (opts.only_marketable !== false) items = items.filter((c) => c.in_stock);
  if (opts.min_price_toman != null) items = items.filter((c) => c.price_toman != null && c.price_toman >= opts.min_price_toman);
  if (opts.max_price_toman != null) items = items.filter((c) => c.price_toman != null && c.price_toman <= opts.max_price_toman);
  const upstreamMin = num(data.min_price);
  const upstreamMax = num(data.max_price);
  const priceSent =
    opts.min_price_toman != null &&
    opts.max_price_toman != null &&
    upstreamMin != null &&
    upstreamMax != null &&
    upstreamMin >= opts.min_price_toman * 0.5 &&
    upstreamMax <= opts.max_price_toman * 1.5;
  return {
    items: items.slice(0, limit),
    page,
    total_items_estimate: typeof data.count === "number" ? data.count : null,
    estimate_capped: data.count === 1200,
    price_min_toman: upstreamMin,
    price_max_toman: upstreamMax,
    price_filter_sent_upstream: Boolean(priceSent),
    categories: (data.categories ?? []).slice(0, 20).map(catRef),
    parent_categories: (data.parent_categories ?? []).map(catRef),
    spellcheck: data.spellcheck?.is_spellchecked
      ? { from: data.spellcheck.initial_query, to: data.spellcheck.corrected_query }
      : null,
    ...(opts.query ? matchQuery(opts.query, items) : { low_confidence: false, unmatched_terms: [] }),
  };
}

function catRef(c) {
  return { id: Number(c.cat_id ?? c.id), title: c.title ?? null };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function clamp(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export async function productDetails(id) {
  assertId(id);
  return torobGet("/v4/base-product/details/", { prk: id });
}

export function assertId(id) {
  if (typeof id !== "string" || !/^[0-9a-f-]{16,}$/i.test(id)) {
    throw new Error("Product id must be a Torob random_key (UUID), from search or browse.");
  }
}

export function keySpecs(detail) {
  const groups = [];
  for (const group of detail.key_specs ?? []) {
    const items = [];
    for (const row of group.items ?? []) {
      const value = Array.isArray(row.value) ? row.value.filter(Boolean).join("، ") : String(row.value ?? "");
      if (!row.key || !value || /^\d+$/.test(value)) continue;
      items.push({ name: row.key, value });
    }
    if (items.length) groups.push({ group: group.header || "مشخصات", items });
  }
  return groups;
}

export function sellerRow(s) {
  const complaints = s.score_info?.complaints_info?.summary;
  return {
    shop_id: s.shop_id ?? null,
    shop: s.shop_name ?? null,
    city: s.shop_name2 || null,
    price_toman: typeof s.price === "number" && s.price > 0 ? s.price : null,
    in_stock: s.availability === true && s.price_text_mode !== "disabled",
    price_unreliable: s.is_price_unreliable === true,
    score: s.score_info?.score ?? s.shop_score ?? null,
    score_text: s.score_info?.score_text ?? null,
    buyer_notes: Array.isArray(complaints) ? complaints.slice(0, 4) : [],
    warranty_listed: s.guarantee_info?.status === "enabled",
    last_price_change: s.last_price_change_date || null,
    is_ad: s.is_adv === true,
    listing_title: s.name1 || null,
  };
}

export function htmlToText(html) {
  return String(html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function fold(s) {
  return faToEn(String(s))
    .replace(/[\u200c\u200d]/g, "")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .toLowerCase();
}

export function matchQuery(query, items) {
  const terms = fold(query)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 1);
  if (!terms.length || !items.length) return { low_confidence: false, unmatched_terms: [] };
  const blob = items.map((it) => fold(`${it.title ?? ""} ${it.title_en ?? ""}`)).join("\n");
  const unmatched = terms.filter((t) => !blob.includes(t));
  return { low_confidence: unmatched.length === terms.length, unmatched_terms: unmatched };
}
