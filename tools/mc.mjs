#!/usr/bin/env node
// 通用桥客户端小工具：把常用查询做成子命令，避免在 shell 里拼 JSON。
//
//   node tools/mc.mjs block   <x> <y> <z>
//   node tools/mc.mjs column  <x> <z> [yTop] [yBot]        # 竖直剖面（跳过空气）
//   node tools/mc.mjs ground  <x> <z> [yTop] [yBot]        # 该列地表高度
//   node tools/mc.mjs biome   <x> <y> <z>
//   node tools/mc.mjs count   <x1> <y1> <z1> <x2> <y2> <z2>
//   node tools/mc.mjs player
//   node tools/mc.mjs cmd     <原版命令...>
//   node tools/mc.mjs set     <x> <y> <z> <block> [jsonProps]
//   node tools/mc.mjs fill    <x1> <y1> <z1> <x2> <y2> <z2> <block> [jsonProps]
//   node tools/mc.mjs time    <day|night|noon|midnight|数字>
//   node tools/mc.mjs tp      <x> <y> <z> [yaw] [pitch]
//   node tools/mc.mjs look    <x> <y> <z>
//
// 环境变量：MCPBRIDGE_TOKEN / MCPBRIDGE_URL

const URL_BASE = (process.env.MCPBRIDGE_URL ?? "http://127.0.0.1:8765").replace(/\/+$/, "");
import { pathToFileURL } from "node:url";
const TOKEN = process.env.MCPBRIDGE_TOKEN;
if (!TOKEN) {
  console.error("缺少 MCPBRIDGE_TOKEN");
  process.exit(1);
}

let id = 0;
export async function rpc(method, params = {}) {
  const res = await fetch(`${URL_BASE}/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(`[${body.error.code}] ${body.error.message}`);
  return body.result;
}

export const IGNORE = new Set([
  "minecraft:air", "minecraft:cave_air", "minecraft:void_air", "minecraft:water",
  "minecraft:short_grass", "minecraft:tall_grass", "minecraft:pink_petals",
  "minecraft:fern", "minecraft:large_fern", "minecraft:snow", "minecraft:vine",
  "minecraft:cherry_leaves", "minecraft:oak_leaves", "minecraft:dark_oak_leaves",
  "minecraft:spruce_leaves", "minecraft:birch_leaves", "minecraft:jungle_leaves",
  "minecraft:acacia_leaves", "minecraft:azalea_leaves", "minecraft:flowering_azalea_leaves",
  "minecraft:mangrove_leaves", "minecraft:torch", "minecraft:wall_torch",
  "minecraft:dandelion", "minecraft:poppy", "minecraft:cornflower", "minecraft:lily_of_the_valley",
]);

export async function groundAt(x, z, yTop = 200, yBot = -64) {
  for (let yb = yTop; yb > yBot; yb -= 8) {
    const ya = Math.max(yBot, yb - 7);
    const r = await rpc("scan_blocks", { x1: x, y1: ya, z1: z, x2: x, y2: yb, z2: z });
    const counts = r.counts ?? {};
    if (!Object.entries(counts).some(([k, v]) => v > 0 && !IGNORE.has(k))) continue;
    for (let y = yb; y >= ya; y--) {
      const b = await rpc("get_block", { x, y, z });
      if (!b.isAir && !IGNORE.has(b.block)) return { y, b: b.block };
    }
  }
  return { y: null, b: null };
}

async function main() {
  const [cmd, ...a] = process.argv.slice(2);
  const n = a.map(Number);
  switch (cmd) {
    case "block": {
      console.log(JSON.stringify(await rpc("get_block", { x: n[0], y: n[1], z: n[2] })));
      break;
    }
    case "column": {
      const [x, z, yTop = 200, yBot = -64] = n;
      console.log(`柱剖面 x=${x} z=${z}`);
      for (let y = yTop; y >= yBot; y--) {
        const b = await rpc("get_block", { x, y, z });
        if (!b.isAir) console.log(`  y=${String(y).padStart(4)}  ${b.block}`);
      }
      break;
    }
    case "ground": {
      const [x, z, yTop = 200, yBot = -64] = n;
      const g = await groundAt(x, z, yTop, yBot);
      console.log(`地表 x=${x} z=${z} -> y=${g.y} ${g.b}`);
      break;
    }
    case "biome": {
      console.log(JSON.stringify(await rpc("get_biome", { x: n[0], y: n[1], z: n[2] })));
      break;
    }
    case "count": {
      const r = await rpc("scan_blocks", { x1: n[0], y1: n[1], z1: n[2], x2: n[3], y2: n[4], z2: n[5] });
      console.log(`体积 ${r.volume}`);
      for (const [k, v] of Object.entries(r.counts ?? {}).sort((p, q) => q[1] - p[1])) {
        console.log(`  ${String(v).padStart(8)}  ${k}`);
      }
      break;
    }
    case "player": {
      console.log(JSON.stringify(await rpc("get_player", {}), null, 2));
      break;
    }
    case "cmd": {
      console.log(JSON.stringify(await rpc("run_command", { command: a.join(" ") }), null, 2));
      break;
    }
    case "set": {
      const [x, y, z] = n;
      const block = a[3];
      const props = a[4] ? JSON.parse(a[4]) : undefined;
      console.log(JSON.stringify(await rpc("set_block", { x, y, z, block, ...(props ? { properties: props } : {}) })));
      break;
    }
    case "fill": {
      const [x1, y1, z1, x2, y2, z2] = n;
      const block = a[6];
      const props = a[7] ? JSON.parse(a[7]) : undefined;
      console.log(JSON.stringify(await rpc("fill_blocks", { x1, y1, z1, x2, y2, z2, block, ...(props ? { properties: props } : {}) })));
      break;
    }
    case "time": {
      console.log(JSON.stringify(await rpc("set_time", { time: a[0] })));
      break;
    }
    case "tp": {
      console.log(JSON.stringify(await rpc("player_move", { x: n[0], y: n[1], z: n[2], ...(a[3] !== undefined ? { yaw: n[3] } : {}), ...(a[4] !== undefined ? { pitch: n[4] } : {}) })));
      break;
    }
    case "look": {
      console.log(JSON.stringify(await rpc("look_at", { x: n[0], y: n[1], z: n[2] })));
      break;
    }
    default:
      console.error("用法见文件头注释");
      process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error("✗ " + e.message);
    process.exit(1);
  });
}
