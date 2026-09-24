// Live check against Torob through the local HTTP server.
//   node src/index.js --http 8787
//   node scripts/verify.mjs
const ENDPOINT = process.env.TOROB_MCP_URL ?? "http://127.0.0.1:8787/mcp";

let id = 1;
async function rpc(method, params = {}) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: id++, method, params }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  const payload =
    text
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .filter(Boolean)
      .at(-1) ?? text;
  return JSON.parse(payload);
}

const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " - " + detail : ""}`);
}

const init = await rpc("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "verify", version: "0.1.0" },
});
check("handshake", init.result?.serverInfo?.name === "torob-mcp", init.result?.serverInfo?.name ?? "");

const listed = await rpc("tools/list", {});
const names = (listed.result?.tools ?? []).map((t) => t.name);
check("16 tools", names.length === 16, String(names.length));
check("all read-only", (listed.result?.tools ?? []).every((t) => t.annotations?.readOnlyHint === true));

const search = await rpc("tools/call", { name: "search_torob", arguments: { query: "هدفون بی سیم", limit: 3 } });
const body = JSON.parse(search.result?.content?.[0]?.text ?? "{}");
const first = body.items?.[0] ?? {};
check("search returns items", (body.items ?? []).length > 0, String(body.items?.length ?? 0));
check(
  "search matches the query",
  typeof first.title === "string" && /هدفون|ایرپاد|هندزفری/.test(first.title),
  first.title ?? ""
);
check("price in toman", typeof first.price_toman === "number", String(first.price_toman));
check("torob url", typeof first.url === "string" && first.url.includes("torob.com"), first.url ?? "");
check("search names unmatched terms", Array.isArray(body.unmatched_terms));

const details = await rpc("tools/call", { name: "product_details", arguments: { id: first.id } });
const d = JSON.parse(details.result?.content?.[0]?.text ?? "{}");
check("details title", typeof d.title === "string" && d.title.length > 0, d.title ?? "");

const sellers = await rpc("tools/call", { name: "product_sellers", arguments: { id: first.id, limit: 3 } });
const s = JSON.parse(sellers.result?.content?.[0]?.text ?? "{}");
check("sellers", Array.isArray(s.sellers) && s.sellers.length > 0, String(s.sellers?.length ?? 0));
check("seller trust notes", Array.isArray(s.sellers?.[0]?.buyer_notes));

const guide = await rpc("tools/call", { name: "product_guide", arguments: { id: first.id } });
const g = JSON.parse(guide.result?.content?.[0]?.text ?? "{}");
check("product guide", typeof g.has_guide === "boolean", g.has_guide ? `${g.text.length} chars` : "empty");

const shopId = s.sellers?.[0]?.shop_id;
if (shopId) {
  const shop = await rpc("tools/call", { name: "shop_profile", arguments: { shop_id: shopId } });
  const shopBody = JSON.parse(shop.result?.content?.[0]?.text ?? "{}");
  check("shop profile", typeof shopBody.name === "string" && shopBody.name.length > 0, shopBody.name ?? "");
}

const bad = await rpc("tools/call", { name: "product_details", arguments: { id: "nope" } });
check("bad id is an error", bad.result?.isError === true);

const failed = checks.filter((c) => !c.ok);
process.exit(failed.length ? 1 : 0);
