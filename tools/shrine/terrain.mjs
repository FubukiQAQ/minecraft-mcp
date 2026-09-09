#!/usr/bin/env node
// 场地整备：把选定区域削成「阶梯式台地」——参道自南向北逐级升高，内院为一整块平台。
//
// 高程设计（世界 y）：
//   z = 66 (v=0)   -> y 69   （鸟居入口，最低）
//   z = -6 (v=-72) -> y 63   （内院前，最高）
//   每 12 格升高 1 格（1:12 缓坡），z <= -6 的内院统一 y 63。
//
// 幂等：可以反复运行，每次都把整个场地重新削平。
//   node tools/shrine/terrain.mjs

import { fill, printStats, wz, levelAt } from "./lib.mjs";

const U_MIN = -56;
const U_MAX = 56;
const V_MIN = -192;
const V_MAX = 20;
const Y_FLOOR = 55;
const Y_CEIL = 92;

console.log("整备场地：阶梯台地");
for (let v = V_MIN; v <= V_MAX; v += 12) {
  console.log(`  v=${String(v).padStart(4)} (z=${String(wz(v)).padStart(4)}) -> 台面 y=${levelAt(v)}`);
}

// 1) 自下往上整体灌石（消除树、草、起伏），再从台面上一格清到高空
console.log("\n[1/4] 灌石…");
await fill(U_MIN, V_MIN, Y_FLOOR, U_MAX, V_MAX, Y_CEIL, "minecraft:stone");

console.log("[2/4] 清空台面以上…");
for (let v = V_MIN; v <= V_MAX; v++) {
  const top = levelAt(v);
  await fill(U_MIN, v, top + 1, U_MAX, v, Y_CEIL, "minecraft:air");
}

// 3) 铺表层：台面下一层土，台面一层草方块
console.log("[3/4] 铺表层…");
for (let v = V_MIN; v <= V_MAX; v++) {
  const top = levelAt(v);
  await fill(U_MIN, v, top - 1, U_MAX, v, top - 1, "minecraft:dirt");
  await fill(U_MIN, v, top, U_MAX, v, top, "minecraft:grass_block");
}

// 4) 参道：中央 17 宽的石板路 + 两侧路缘 + 前庭
console.log("[4/4] 铺参道与前庭…");
for (let v = V_MIN; v <= V_MAX; v++) {
  const top = levelAt(v);
  await fill(-8, v, top, 8, v, top, "minecraft:andesite");
  await fill(-8, v, top, -8, v, top, "minecraft:stone_bricks");
  await fill(8, v, top, 8, v, top, "minecraft:stone_bricks");
  if ((wz(v) + 200) % 8 === 0) await fill(-1, v, top, 1, v, top, "minecraft:stone_bricks");
}
for (let v = -128; v <= -114; v++) {
  const top = levelAt(v);
  await fill(-30, v, top, 30, v, top, "minecraft:stone_bricks");
}

printStats("场地整备");
