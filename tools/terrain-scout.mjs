#!/usr/bin/env node
// 地表采样器 v2：只认「地面」（忽略树叶/花草/水），并在每个采样格内额外测 ±2 格的
// 起伏，输出「平均高度 + 粗糙度」两幅图 —— 用来挑一块真正平整的场地。
//
//   node tools/terrain-scout.mjs <x1> <z1> <x2> <z2> [step] [yTop] [yBot]

import { rpc, IGNORE } from "./mc.mjs";

const [x1, z1, x2, z2, stepArg, yTopArg, yBotArg] = process.argv.slice(2).map(Number);
const step = stepArg || 8;
const Y_TOP = yTopArg ?? 200;
const Y_BOT = yBotArg ?? -64;

/** 真正的地面：跳过 air/水/植被/树叶 */
async function groundAt(x, z) {
  for (let yb = Y_TOP; yb > Y_BOT; yb -= 8) {
    const ya = Math.max(Y_BOT, yb - 7);
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

const nx = Math.floor((x2 - x1) / step) + 1;
const nz = Math.floor((z2 - z1) / step) + 1;
const total = nx * nz;
console.log(`采样 x[${x1}..${x2}] z[${z1}..${z2}] step=${step} -> ${nx}x${nz}=${total} 格`);

const t0 = Date.now();
let done = 0;
const ys = new Array(nz);
const rgh = new Array(nz);
let minY = 9999;
let maxY = -9999;

const tasks = [];
for (let iz = 0; iz < nz; iz++) {
  ys[iz] = new Array(nx).fill(null);
  rgh[iz] = new Array(nx).fill(null);
  for (let ix = 0; ix < nx; ix++) {
    const x = x1 + ix * step;
    const z = z1 + iz * step;
    tasks.push(
      (async () => {
        const g = await groundAt(x, z);
        ys[iz][ix] = g.y;
        if (g.y !== null) {
          minY = Math.min(minY, g.y);
          maxY = Math.max(maxY, g.y);
        }
        // 粗糙度：±2 格四个方向的起伏极差（同一采样格内）
        const near = [];
        for (const [dx, dz] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) {
          const gg = await groundAt(x + dx, z + dz);
          if (gg.y !== null) near.push(gg.y);
        }
        if (g.y !== null && near.length) {
          rgh[iz][ix] = Math.max(...near, g.y) - Math.min(...near, g.y);
        }
        done++;
        if (done % 25 === 0 || done === total) {
          process.stderr.write(`\r  ${done}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
        }
      })(),
    );
  }
}
await Promise.all(tasks);
process.stderr.write("\n");

const CH = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const header = "      " + Array.from({ length: nx }, (_, i) => {
  const v = ((x1 + i * step) % 100 + 100) % 100;
  return String(Math.floor(v / 10))[0];
}).join("");

console.log(`\n== 地表高度 ==  min=${minY} max=${maxY}`);
console.log(`图例: 0=${minY} 起逐级 +1（数字/小写/大写），'?'=无数据`);
console.log(header);
for (let iz = 0; iz < nz; iz++) {
  const z = z1 + iz * step;
  console.log(String(z).padStart(5) + " " + ys[iz].map((y) => (y === null ? "?" : CH[Math.min(CH.length - 1, y - minY)])).join(""));
}

console.log(`\n== 粗糙度（±2 格高差，0=平坦） ==`);
console.log(header);
for (let iz = 0; iz < nz; iz++) {
  const z = z1 + iz * step;
  console.log(String(z).padStart(5) + " " + rgh[iz].map((d) => (d === null ? "?" : d > 9 ? "+" : String(d))).join(""));
}
console.log(`行首为 z，每列 ${step} 格`);
