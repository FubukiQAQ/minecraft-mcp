#!/usr/bin/env node
// 调试用命令行客户端：直接调用游戏内 HTTP 桥上的方法，无需启动 MCP server。
//
//   export MCPBRIDGE_TOKEN=<令牌>            # 或
//   export MCPBRIDGE_GAME_DIR=<.minecraft>    # 自动读 config/mcpbridge.token
//   node tools/call.mjs get_player
//   node tools/call.mjs get_block '{"x":0,"y":64,"z":0}'
//   node tools/call.mjs fill_blocks '{"x1":0,"y1":64,"z1":0,"x2":6,"y2":64,"z2":6,"block":"minecraft:oak_planks"}'

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const URL_BASE = (process.env.MCPBRIDGE_URL ?? "http://127.0.0.1:8765").replace(/\/+$/, "");

function resolveToken() {
  if (process.env.MCPBRIDGE_TOKEN) return process.env.MCPBRIDGE_TOKEN;
  const dirs = [];
  if (process.env.MCPBRIDGE_GAME_DIR) dirs.push(join(process.env.MCPBRIDGE_GAME_DIR, "config"));
  if (process.env.MCPBRIDGE_CONFIG) dirs.push(process.env.MCPBRIDGE_CONFIG);
  dirs.push(join(process.cwd(), "config"));
  for (const d of dirs) {
    const f = join(d, "mcpbridge.token");
    if (existsSync(f)) {
      const t = readFileSync(f, "utf8").trim();
      if (t) return t;
    }
  }
  throw new Error("找不到令牌：请设置 MCPBRIDGE_TOKEN 或 MCPBRIDGE_GAME_DIR");
}

const [method, paramsArg] = process.argv.slice(2);
if (!method) {
  console.error("用法: node tools/call.mjs <method> [paramsJson]");
  process.exit(1);
}
const params = paramsArg ? JSON.parse(paramsArg) : {};

const res = await fetch(`${URL_BASE}/rpc`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${resolveToken()}` },
  body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
});

const body = await res.json();
if (body.error) {
  console.error(`✗ [${body.error.code}] ${body.error.message}`);
  process.exit(2);
}
console.log(JSON.stringify(body.result, null, 2));
