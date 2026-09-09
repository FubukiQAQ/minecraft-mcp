#!/usr/bin/env node
// 沿一条直线采样地表高度，输出表格（用于设计阶梯式参道）。
//   node tools/profile.mjs <x1> <z1> <x2> <z2> [step]

import { groundAt } from "./mc.mjs";

const [x1, z1, x2, z2, stepArg] = process.argv.slice(2).map(Number);
const step = stepArg || 2;
const len = Math.hypot(x2 - x1, z2 - z1);
const n = Math.floor(len / step);
const dx = (x2 - x1) / len;
const dz = (z2 - z1) / len;

console.log(`剖面 (${x1},${z1}) -> (${x2},${z2}) 步长 ${step}`);
console.log("   t     x      z     y   方块");
const tasks = [];
const rows = [];
for (let i = 0; i <= n; i++) {
  const t = i * step;
  const x = Math.round(x1 + dx * t);
  const z = Math.round(z1 + dz * t);
  rows.push({ t, x, z });
  tasks.push(
    groundAt(x, z).then((g) => {
      rows[i].y = g.y;
      rows[i].b = g.b;
    }),
  );
}
await Promise.all(tasks);
for (const r of rows) {
  console.log(`${String(r.t).padStart(5)} ${String(r.x).padStart(6)} ${String(r.z).padStart(6)} ${String(r.y ?? "?").padStart(5)}   ${(r.b ?? "").replace("minecraft:", "")}`);
}
