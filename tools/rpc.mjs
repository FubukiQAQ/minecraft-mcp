#!/usr/bin/env node
// 批量 RPC 运行器：从 stdin 读 JSON Lines，每行 {"method":..,"params":{..}}，
// 顺序调用游戏内 HTTP 桥，只打印失败项与统计，避免刷屏。
//
//   node tools/rpc.mjs < cmds.jsonl
//
// 环境变量：MCPBRIDGE_TOKEN / MCPBRIDGE_URL / RPC_VERBOSE=1

import { createInterface } from "node:readline";

const URL_BASE = (process.env.MCPBRIDGE_URL ?? "http://127.0.0.1:8765").replace(/\/+$/, "");
const TOKEN = process.env.MCPBRIDGE_TOKEN;
if (!TOKEN) {
  console.error("缺少 MCPBRIDGE_TOKEN");
  process.exit(1);
}
const VERBOSE = process.env.RPC_VERBOSE === "1";

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

let id = 0;
let ok = 0;
let fail = 0;
let bytes = 0;
const t0 = Date.now();
const failures = [];

async function rpc(method, params) {
  const res = await fetch(`${URL_BASE}/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  return res.json();
}

for await (const rawLine of rl) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  let req;
  try {
    req = JSON.parse(line);
  } catch (e) {
    console.error(`✗ JSON 解析失败: ${line.slice(0, 120)}`);
    fail++;
    continue;
  }
  let body;
  try {
    body = await rpc(req.method, req.params ?? {});
  } catch (e) {
    failures.push(`${req.method}: ${e.message}`);
    fail++;
    continue;
  }
  if (body.error) {
    failures.push(`${req.method} ${JSON.stringify(req.params).slice(0, 200)} -> [${body.error.code}] ${body.error.message}`);
    fail++;
    continue;
  }
  ok++;
  const s = JSON.stringify(body.result);
  bytes += s.length;
  if (VERBOSE || req.method === "run_command" || req.method === "scan_blocks" || req.method === "get_block") {
    console.log(`${req.method}: ${s.length > 600 ? s.slice(0, 600) + "…" : s}`);
  }
}

const dt = Date.now() - t0;
console.log(`\n=== 完成: ok=${ok} fail=${fail} 用时=${(dt / 1000).toFixed(1)}s 平均=${ok ? (dt / ok).toFixed(1) : "-"}ms/条 ===`);
if (failures.length) {
  console.log(`--- 失败明细 (${failures.length}) ---`);
  for (const f of failures.slice(0, 40)) console.log("  " + f);
  if (failures.length > 40) console.log(`  …还有 ${failures.length - 40} 条`);
  process.exitCode = 1;
}
