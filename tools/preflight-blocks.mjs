#!/usr/bin/env node
// 建造前的方块预检：把要用的方块在某处试放一遍，确认 ID 与 properties 都存在。
// 用法: MCPBRIDGE_TOKEN=xxx node tools/preflight-blocks.mjs

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const URL_BASE = (process.env.MCPBRIDGE_URL ?? "http://127.0.0.1:8765").replace(/\/+$/, "");
function resolveToken() {
  if (process.env.MCPBRIDGE_TOKEN) return process.env.MCPBRIDGE_TOKEN;
  const dirs = [];
  if (process.env.MCPBRIDGE_CONFIG) dirs.push(process.env.MCPBRIDGE_CONFIG);
  for (const d of dirs) {
    const f = join(d, "mcpbridge.token");
    if (existsSync(f)) {
      const t = readFileSync(f, "utf8").trim();
      if (t) return t;
    }
  }
  throw new Error("找不到令牌");
}
const TOKEN = resolveToken();

let id = 0;
async function rpc(method, params) {
  const res = await fetch(`${URL_BASE}/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(`[${body.error.code}] ${body.error.message}`);
  return body.result;
}

const CANDIDATES = [
  ["minecraft:stone_bricks", null],
  ["minecraft:polished_andesite", null],
  ["minecraft:chiseled_stone_bricks", null],
  ["minecraft:red_concrete", null],
  ["minecraft:dark_oak_log", { axis: "y" }],
  ["minecraft:dark_oak_planks", null],
  ["minecraft:dark_oak_slab", { type: "bottom" }],
  ["minecraft:dark_oak_stairs", { facing: "north" }],
  ["minecraft:deepslate_tiles", null],
  ["minecraft:deepslate_tile_slab", { type: "bottom" }],
  ["minecraft:deepslate_tile_stairs", { facing: "north" }],
  ["minecraft:oxidized_copper", null],
  ["minecraft:oxidized_copper_stairs", { facing: "north" }],
  ["minecraft:oxidized_copper_slab", { type: "bottom" }],
  ["minecraft:glass_pane", null],
  ["minecraft:lantern", { hanging: "false" }],
  ["minecraft:stone_brick_wall", null],
  ["minecraft:stone_brick_stairs", { facing: "south" }],
  ["minecraft:stone_brick_slab", { type: "bottom" }],
  ["minecraft:gold_block", null],
  ["minecraft:bell", { attachment: "ceiling", facing: "north" }],
  ["minecraft:barrel", { facing: "north", open: "false" }],
  ["minecraft:spruce_log", { axis: "y" }],
  ["minecraft:spruce_leaves", null],
  ["minecraft:dark_oak_trapdoor", { facing: "north", half: "bottom", open: "false" }],
  ["minecraft:polished_andesite_slab", { type: "bottom" }],
  ["minecraft:quartz_block", null],
];

const SY = 60; // 试放高度（空中，不会破坏场景）
let bad = 0;
for (let i = 0; i < CANDIDATES.length; i++) {
  const [block, props] = CANDIDATES[i];
  const p = { x: -111 + i, y: SY, z: -92, block };
  if (props) p.properties = props;
  try {
    await rpc("set_block", p);
    console.log(`  ok   ${block}${props ? " " + JSON.stringify(props) : ""}`);
  } catch (e) {
    bad++;
    console.log(`  FAIL ${block}${props ? " " + JSON.stringify(props) : ""}  ${e.message}`);
  }
}
// 清理
await rpc("fill_blocks", { x1: -111, y1: SY, z1: -92, x2: -111 + CANDIDATES.length, y2: SY, z2: -92, block: "minecraft:air" });
console.log(`\n预检完成：${CANDIDATES.length - bad} 可用，${bad} 失败`);
