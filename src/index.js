#!/usr/bin/env node
import { createServer } from "node:http";
import { callTool, tools } from "./server.js";

const SERVER = { name: "torob-mcp", version: "0.2.0" };

function rpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function handle(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: SERVER,
    });
  }
  if (method === "notifications/initialized" || method === "ping") {
    return id == null ? null : rpcResult(id, {});
  }
  if (method === "tools/list") {
    return rpcResult(id, { tools });
  }
  if (method === "tools/call") {
    const result = await callTool(params?.name, params?.arguments ?? {});
    return rpcResult(id, result);
  }
  if (id == null) return null;
  return rpcError(id, -32601, `Method not found: ${method}`);
}

function startStdio() {
  let buf = Buffer.alloc(0);
  process.stdin.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      const headerEnd = buf.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        const lineEnd = buf.indexOf("\n");
        if (lineEnd === -1) return;
        const line = buf.slice(0, lineEnd).toString("utf8").trim();
        buf = buf.slice(lineEnd + 1);
        if (!line.startsWith("{")) continue;
        void dispatch(line);
        continue;
      }
      const header = buf.slice(0, headerEnd).toString("utf8");
      const match = /content-length:\s*(\d+)/i.exec(header);
      if (!match) {
        buf = buf.slice(headerEnd + 4);
        continue;
      }
      const len = Number(match[1]);
      const start = headerEnd + 4;
      if (buf.length < start + len) return;
      const body = buf.slice(start, start + len).toString("utf8");
      buf = buf.slice(start + len);
      void dispatch(body);
    }
  });
}

async function dispatch(body) {
  let msg;
  try {
    msg = JSON.parse(body);
  } catch {
    return;
  }
  const response = await handle(msg);
  if (!response) return;
  const json = JSON.stringify(response);
  const payload = Buffer.from(json, "utf8");
  process.stdout.write(`Content-Length: ${payload.length}\r\n\r\n`);
  process.stdout.write(payload);
}

function startHttp(port) {
  const server = createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, ...SERVER }));
      return;
    }
    if (req.method === "OPTIONS" && req.url?.startsWith("/mcp")) {
      res.writeHead(204, {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type, accept",
      });
      res.end();
      return;
    }
    if (req.method !== "POST" || !req.url?.startsWith("/mcp")) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    let msg;
    try {
      msg = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "invalid json" }));
      return;
    }
    const response = await handle(msg);
    const body = JSON.stringify(response ?? { jsonrpc: "2.0", result: {} });
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "access-control-allow-origin": "*",
      "cache-control": "no-cache",
    });
    res.end(`data: ${body}\n\n`);
  });
  server.listen(port, "0.0.0.0", () => {
    process.stderr.write(`torob-mcp listening on http://0.0.0.0:${port}/mcp\n`);
  });
}

const httpFlag = process.argv.indexOf("--http");
if (httpFlag !== -1) {
  const port = Number(process.argv[httpFlag + 1] || process.env.PORT) || 8787;
  startHttp(port);
} else {
  startStdio();
}
