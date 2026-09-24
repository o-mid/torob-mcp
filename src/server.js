import {
  assertId,
  card,
  clamp,
  keySpecs,
  productDetails,
  productUrl,
  searchProducts,
  sellerRow,
  shopCount,
  torobGet,
} from "./torob.js";

const READONLY = { readOnlyHint: true, openWorldHint: true };

export const tools = [
  {
    name: "torob_suggest",
    description:
      "Autocomplete a vague Persian or English query into real Torob search phrases. Call this before search when the wording is colloquial.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What the user typed" },
        limit: { type: "number", description: "Max suggestions (default 10, max 20)" },
      },
      required: ["query"],
    },
    annotations: READONLY,
  },
  {
    name: "search_torob",
    description:
      "Search Torob. Each card is one base product: cheapest price in Toman across shops, shop count, stock, and a torob.com URL. Prices move; always link the URL.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        category_id: { type: "number" },
        brand_id: { type: "number", description: "From product_details brand.id. Pair it with category_id." },
        sort: {
          type: "string",
          enum: ["popular", "cheapest", "expensive", "newest", "most_sellers"],
        },
        page: { type: "number", description: "1-based" },
        limit: { type: "number", description: "Default 10, max 24" },
        min_price_toman: { type: "number" },
        max_price_toman: { type: "number" },
        only_marketable: { type: "boolean", description: "Default true. Hides listings Torob marks unavailable." },
      },
    },
    annotations: READONLY,
  },
  {
    name: "browse_category",
    description: "Browse one Torob category by id. Same cards as search, plus child categories.",
    inputSchema: {
      type: "object",
      properties: {
        category_id: { type: "number" },
        brand_id: { type: "number", description: "From product_details brand.id" },
        sort: { type: "string", enum: ["popular", "cheapest", "expensive", "newest", "most_sellers"] },
        page: { type: "number" },
        limit: { type: "number" },
        min_price_toman: { type: "number" },
        max_price_toman: { type: "number" },
        only_marketable: { type: "boolean" },
      },
      required: ["category_id"],
    },
    annotations: READONLY,
  },
  {
    name: "search_filters",
    description:
      "Categories and the observed price span for a query. Torob does not publish a brand-id catalogue on search; brand shows up as a breadcrumb on product_details.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
    annotations: READONLY,
  },
  {
    name: "product_details",
    description:
      "One base product: cheapest and highest listed price in Toman, shop count, category, key specs, and the Torob page URL. Seller rows are a separate tool.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "random_key UUID from search" },
        spec_keyword: { type: "string" },
        include_specs: { type: "boolean" },
      },
      required: ["id"],
    },
    annotations: READONLY,
  },
  {
    name: "product_sellers",
    description:
      "Shops listing this product, cheapest reliable prices first. Each row has shop name, city, price in Toman, Torob shop score, and whether Torob marked the price unreliable.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        limit: { type: "number", description: "Default 10, max 30" },
        include_unreliable: { type: "boolean", description: "Default false" },
      },
      required: ["id"],
    },
    annotations: READONLY,
  },
  {
    name: "product_stores",
    description:
      "Physical shops that stock this product: name, city, address, open/closed, and price in Toman.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        limit: { type: "number", description: "Default 10, max 30" },
      },
      required: ["id"],
    },
    annotations: READONLY,
  },
  {
    name: "shop_profile",
    description:
      "Public profile of one Torob shop: name, domain, city, enamad, score, and how long it has been on Torob. Shop id comes from product_sellers or product_stores.",
    inputSchema: {
      type: "object",
      properties: { shop_id: { type: "number" } },
      required: ["shop_id"],
    },
    annotations: READONLY,
  },
  {
    name: "product_variants",
    description: "Storage/RAM/region siblings of a product, each with its own cheapest price and shop count.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    annotations: READONLY,
  },
  {
    name: "product_price_chart",
    description:
      "Torob's price chart: average and minimum price over roughly a year, weekly points, Toman. Compare today's cheapest price to the minimum series, not the average.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    annotations: READONLY,
  },
  {
    name: "product_url",
    description: "UUID to a shareable torob.com URL and title.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
    annotations: READONLY,
  },
  {
    name: "get_products_batch",
    description: "Cards for up to 10 product UUIDs. Unknown ids are listed in missing_ids.",
    inputSchema: {
      type: "object",
      properties: { ids: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 10 } },
      required: ["ids"],
    },
    annotations: READONLY,
  },
  {
    name: "compare_products",
    description: "2 to 5 products side by side. Only key specs that differ are returned.",
    inputSchema: {
      type: "object",
      properties: {
        ids: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
        spec_keyword: { type: "string" },
      },
      required: ["ids"],
    },
    annotations: READONLY,
  },
  {
    name: "find_best_value",
    description:
      "Best matches under a Toman budget. Walks up to 3 cheapest-first pages, drops anything over budget, then ranks by how many shops list it and by price. Torob cards have no star rating.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        budget_toman: { type: "number" },
        category_id: { type: "number" },
        limit: { type: "number", description: "Default 3, max 10" },
        pages: { type: "number", description: "Default 1, max 3" },
      },
      required: ["query", "budget_toman"],
    },
    annotations: READONLY,
  },
  {
    name: "similar_products",
    description: "Products Torob lists as similar to this one.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        limit: { type: "number" },
        max_price_toman: { type: "number" },
        only_marketable: { type: "boolean" },
      },
      required: ["id"],
    },
    annotations: READONLY,
  },
];

function ok(data) {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

function fail(message) {
  return { content: [{ type: "text", text: message }], isError: true };
}

export async function callTool(name, args = {}) {
  try {
    const data = await dispatch(name, args);
    return ok(data);
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err));
  }
}

async function dispatch(name, args) {
  switch (name) {
    case "torob_suggest":
      return suggest(args);
    case "search_torob":
      return searchProducts(args);
    case "browse_category":
      if (args.category_id == null) throw new Error("category_id is required");
      return searchProducts({ ...args, query: undefined });
    case "search_filters":
      return filters(args);
    case "product_details":
      return details(args);
    case "product_sellers":
      return sellers(args);
    case "product_stores":
      return stores(args);
    case "shop_profile":
      return shopProfile(args);
    case "product_variants":
      return variants(args);
    case "product_price_chart":
      return chart(args);
    case "product_url":
      return urlOf(args);
    case "get_products_batch":
      return batch(args);
    case "compare_products":
      return compare(args);
    case "find_best_value":
      return bestValue(args);
    case "similar_products":
      return similar(args);
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}

async function suggest(args) {
  if (!args.query) throw new Error("query is required");
  const limit = clamp(args.limit, 10, 1, 20);
  const rows = await torobGet("/suggestion2/", { q: args.query });
  const list = Array.isArray(rows) ? rows : [];
  return {
    keywords: list
      .filter((r) => r && r.text && r.is_history !== true)
      .slice(0, limit)
      .map((r) => r.text),
  };
}

async function filters(args) {
  if (!args.query) throw new Error("query is required");
  const data = await searchProducts({ query: args.query, limit: 1, only_marketable: false });
  return {
    query: args.query,
    categories: data.categories,
    parent_categories: data.parent_categories,
    price_min_toman: data.price_min_toman,
    price_max_toman: data.price_max_toman,
    total_items_estimate: data.total_items_estimate,
    sorts: ["popular", "cheapest", "expensive", "newest", "most_sellers"],
  };
}

function flattenSpecs(detail, keyword) {
  const groups = keySpecs(detail);
  if (!keyword) return groups;
  const q = keyword.toLowerCase();
  return groups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => `${it.name} ${it.value}`.toLowerCase().includes(q)),
    }))
    .filter((g) => g.items.length);
}

async function details(args) {
  const d = await productDetails(args.id);
  const specs = args.include_specs === false ? [] : flattenSpecs(d, args.spec_keyword);
  const specCount = specs.reduce((n, g) => n + g.items.length, 0);
  const brand = (d.breadcrumbs ?? []).find((b) => b.brand_id);
  return {
    id: d.random_key,
    title: d.name1 ?? null,
    title_en: d.name2 || null,
    price_toman: d.price > 0 ? d.price : null,
    min_price_toman: d.min_price > 0 ? d.min_price : null,
    max_price_toman: d.max_price > 0 ? d.max_price : null,
    price_label: d.price_text || null,
    in_stock: d.availability !== false && d.price_text_mode !== "disabled" && d.price > 0,
    shop_count: d.products_info?.count ?? shopCount(d.shop_text),
    shop_text: d.shop_text || null,
    category_id: d.torob_category ?? null,
    category: (d.breadcrumbs ?? []).filter((b) => b.cat_id).map((b) => ({ id: b.cat_id, title: b.title })),
    brand: brand ? { id: brand.brand_id, title: brand.title } : null,
    url: productUrl(d.web_client_absolute_url),
    image_url: d.image_url || null,
    specs: specCount > 40 ? specs.map((g) => ({ ...g, items: g.items.slice(0, 40) })) : specs,
    specs_capped: specCount > 40,
  };
}

async function sellers(args) {
  const d = await productDetails(args.id);
  const limit = clamp(args.limit, 10, 1, 30);
  let rows = (d.products_info?.result ?? []).map(sellerRow);
  if (args.include_unreliable !== true) rows = rows.filter((r) => !r.price_unreliable && r.price_toman != null);
  rows.sort((a, b) => (a.price_toman ?? Infinity) - (b.price_toman ?? Infinity));
  const priced = rows.filter((r) => r.price_toman != null).map((r) => r.price_toman);
  return {
    id: d.random_key,
    title: d.name1 ?? null,
    url: productUrl(d.web_client_absolute_url),
    seller_count: d.products_info?.count ?? rows.length,
    cheapest_reliable_toman: priced[0] ?? null,
    price_stats: priceStats(priced),
    sellers: rows.slice(0, limit),
    note: "Buy links stay on the Torob product page. Shop rows are listings Torob shows, not an order.",
  };
}

function priceStats(prices) {
  if (!prices.length) return null;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return { min_toman: sorted[0], median_toman: median, max_toman: sorted[sorted.length - 1], sample_size: sorted.length };
}

async function stores(args) {
  const d = await productDetails(args.id);
  const limit = clamp(args.limit, 10, 1, 30);
  const rows = (d.products_in_store_info?.result ?? []).map((s) => ({
    shop_id: s.shop_id ?? null,
    shop: s.shop_name ?? null,
    city: s.shop_name2 || null,
    address: s.address || null,
    price_toman: typeof s.price === "number" && s.price > 0 ? s.price : null,
    price_unreliable: s.is_price_unreliable === true,
    is_open: s.is_open ?? null,
    hours: s.working_hours || null,
    distance: s.distance || null,
    last_price_change: s.last_price_change_date || null,
  }));
  return {
    id: d.random_key,
    title: d.name1 ?? null,
    url: productUrl(d.web_client_absolute_url),
    store_count: d.products_in_store_info?.count ?? rows.length,
    stores: rows.slice(0, limit),
  };
}

async function shopProfile(args) {
  const shopId = Number(args.shop_id);
  if (!Number.isFinite(shopId) || shopId <= 0) throw new Error("shop_id must be a positive number");
  const s = await torobGet("/v4/internet-shop/details/", { id: shopId });
  const support = s.customer_support_info ?? {};
  return {
    shop_id: s.id,
    name: s.name ?? null,
    domain: s.domain || null,
    city: s.city || null,
    province: s.province || null,
    address: s.address || null,
    shop_type: s.shop_type || null,
    score: s.shop_score ?? null,
    enamad: s.enamad_level || null,
    enamad_valid_until: s.enamad_expire_date || null,
    active_time: s.active_time || null,
    member_since: s.date_added || null,
    guarantee: s.guarantee_info?.status ?? null,
    support_hours: support.schedule || null,
    phones: Array.isArray(support.phones) ? support.phones.slice(0, 3) : [],
  };
}

async function variants(args) {
  const d = await productDetails(args.id);
  const items = [];
  for (const group of d.variants ?? []) {
    for (const v of group.items ?? []) {
      const c = card(v);
      if (!c) continue;
      items.push({
        ...c,
        group: group.title || null,
        variant_title: v.title || null,
        selected: v.selected === true,
      });
    }
  }
  const priced = items.filter((v) => v.price_toman != null);
  const cheapest = priced.reduce((a, b) => (a == null || b.price_toman < a.price_toman ? b : a), null);
  return {
    id: d.random_key,
    variants: items,
    cheapest_variant_toman: cheapest?.price_toman ?? null,
    cheapest_variant_id: cheapest?.id ?? null,
  };
}

async function chart(args) {
  assertId(args.id);
  const d = await productDetails(args.id);
  const chartData = await torobGet("/v4/base-product/price-chart/", { prk: args.id });
  const series = (chartData.dataSets ?? []).map((set) => {
    const points = (set.entries ?? [])
      .map((e, i) => ({
        index: e.i ?? i,
        day: chartData.labels?.[e.i ?? i] ?? null,
        price_toman: typeof e.val === "number" ? Math.round(e.val) : null,
      }))
      .filter((p) => p.price_toman != null);
    const prices = points.map((p) => p.price_toman);
    return {
      label: set.label || null,
      points,
      low_toman: prices.length ? Math.min(...prices) : null,
      high_toman: prices.length ? Math.max(...prices) : null,
    };
  });
  return {
    id: args.id,
    title: d.name1 ?? null,
    url: productUrl(d.web_client_absolute_url),
    current_cheapest_toman: d.price > 0 ? d.price : null,
    series,
  };
}

async function urlOf(args) {
  const d = await productDetails(args.id);
  return { id: d.random_key, title: d.name1 ?? null, url: productUrl(d.web_client_absolute_url) };
}

async function batch(args) {
  const ids = [...new Set(args.ids ?? [])].slice(0, 10);
  if (!ids.length) throw new Error("ids is required");
  const items = [];
  const missing = [];
  for (const id of ids) {
    try {
      const d = await productDetails(id);
      const c = card(d);
      if (c) items.push(c);
      else missing.push(id);
    } catch {
      missing.push(id);
    }
  }
  return { items, missing_ids: missing };
}

function specMap(detail, keyword) {
  const map = new Map();
  for (const group of flattenSpecs(detail, keyword)) {
    for (const item of group.items) map.set(item.name, item.value);
  }
  return map;
}

async function compare(args) {
  const ids = [...new Set(args.ids ?? [])];
  if (ids.length < 2 || ids.length > 5) throw new Error("Pass 2 to 5 product ids");
  const details = await Promise.all(ids.map((id) => productDetails(id)));
  const maps = details.map((d) => specMap(d, args.spec_keyword));
  const names = [...new Set(maps.flatMap((m) => [...m.keys()]))];
  const differences = [];
  for (const name of names) {
    const values = maps.map((m) => m.get(name) ?? null);
    if (new Set(values).size <= 1) continue;
    differences.push({ name, values });
  }
  return {
    products: details.map((d) => ({
      id: d.random_key,
      title: d.name1 ?? null,
      price_toman: d.price > 0 ? d.price : null,
      min_price_toman: d.min_price > 0 ? d.min_price : null,
      max_price_toman: d.max_price > 0 ? d.max_price : null,
      shop_count: d.products_info?.count ?? shopCount(d.shop_text),
      in_stock: d.price > 0 && d.price_text_mode !== "disabled",
      url: productUrl(d.web_client_absolute_url),
    })),
    spec_differences: differences,
    spec_differences_note: differences.length
      ? null
      : "No differing key specs. These may be colour or region twins of one model.",
  };
}

async function bestValue(args) {
  if (!args.query) throw new Error("query is required");
  const budget = Number(args.budget_toman);
  if (!Number.isFinite(budget) || budget <= 0) throw new Error("budget_toman must be a positive number of Toman");
  const pages = clamp(args.pages, 1, 1, 3);
  const limit = clamp(args.limit, 3, 1, 10);
  const pool = [];
  for (let page = 1; page <= pages; page++) {
    const data = await searchProducts({
      query: args.query,
      category_id: args.category_id,
      sort: "cheapest",
      page,
      limit: 24,
      max_price_toman: budget,
      only_marketable: true,
    });
    pool.push(...data.items);
    const top = data.items.at(-1)?.price_toman;
    if (data.items.length < 8 || (top != null && top > budget)) break;
  }
  const seen = new Set();
  const unique = pool.filter((c) => {
    if (seen.has(c.id) || c.price_toman == null || c.price_toman > budget) return false;
    seen.add(c.id);
    return true;
  });
  unique.sort((a, b) => (b.shop_count ?? 0) - (a.shop_count ?? 0) || a.price_toman - b.price_toman);
  return {
    query: args.query,
    budget_toman: budget,
    picks: unique.slice(0, limit),
    scanned: unique.length,
    note: "Ranked by shop count, then price. The card price is the cheapest shop Torob listed, and it can be unreliable until you check product_sellers.",
  };
}

async function similar(args) {
  assertId(args.id);
  const limit = clamp(args.limit, 10, 1, 24);
  const data = await torobGet("/v4/base-product/similar-base-product/", { prk: args.id, limit: 24 });
  let items = (data.results ?? []).map(card).filter(Boolean);
  if (args.only_marketable !== false) items = items.filter((c) => c.in_stock);
  if (args.max_price_toman != null) items = items.filter((c) => c.price_toman != null && c.price_toman <= args.max_price_toman);
  return { id: args.id, items: items.slice(0, limit) };
}
