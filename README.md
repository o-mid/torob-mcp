# Torob MCP

Read-only MCP server for [Torob](https://torob.com/). Search, cheapest price in Toman, online shops, in-store stock, specs, variants, and the price chart. No API key. Nothing is written back to Torob.

This project is not affiliated with Torob.

## Run

Node.js 18 or newer.

```bash
npm start
```

That listens on `PORT` (default 8787). MCP clients post JSON-RPC to `/mcp`. `GET /health` returns the version.

Stdio, for a desktop client that launches a process:

```bash
node src/index.js
```

```json
{
  "mcpServers": {
    "torob": {
      "command": "node",
      "args": ["src/index.js"]
    }
  }
}
```

Set the working directory to this repo.

## Tools

| Tool | What it answers |
|---|---|
| `torob_suggest` | Vague wording to real search phrases |
| `search_torob` | Cards: cheapest Toman price, shop count, URL. Optional `brand_id` with a category |
| `browse_category` | One category, plus child categories |
| `search_filters` | Category ids and the price span for a query |
| `product_details` | Price range, category, brand, key specs |
| `product_sellers` | Online shops, city, score, unreliable-price flag, min/median/max |
| `product_stores` | Physical shops: address, hours, open/closed, price |
| `shop_profile` | Shop name, domain, city, enamad, score |
| `product_variants` | Storage / RAM / region siblings and their prices |
| `product_price_chart` | Average and minimum series |
| `product_url` | UUID to a torob.com link |
| `get_products_batch` | Up to 10 cards |
| `compare_products` | 2–5 products, only specs that differ |
| `find_best_value` | Under a Toman budget, ranked by how many shops list it |
| `similar_products` | Torob's similar list |

Product ids are UUIDs (`random_key`). The price on a card is the cheapest shop Torob is showing, in Toman. Some shop rows are flagged `price_unreliable`; `product_sellers` hides those unless you ask for them. `total_items_estimate` is Torob's count and often stops at 1200 (`estimate_capped`).

Price bounds apply to the page that was fetched. Budget questions belong on `find_best_value`.

## Check

```bash
npm start
node scripts/verify.mjs
```

Upstream is Torob's public web API (`api.torob.com`). It is undocumented and can change. Requests are spaced 400ms apart, with a short in-memory cache.
