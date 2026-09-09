#!/usr/bin/env node
// 中国古典建筑群：以 (-111, -1, -92) 为中心，中轴对称的院落式寺庙建筑群。
//
// 局部坐标：u = 东西（+u 为东/+x），v = 南北（+v 为南/+z，建筑正面朝向），
//           h = 离地高度（h=0 即地表那一层，y = -1 + h）
//
// 用法: MCPBRIDGE_CONFIG=<config目录> node tools/build-chinese-temple.mjs

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const URL_BASE = (process.env.MCPBRIDGE_URL ?? "http://127.0.0.1:8765").replace(/\/+$/, "");
function resolveToken() {
  if (process.env.MCPBRIDGE_TOKEN) return process.env.MCPBRIDGE_TOKEN;
  for (const d of [process.env.MCPBRIDGE_CONFIG, join(process.cwd(), "config")]) {
    if (!d) continue;
    const f = join(d, "mcpbridge.token");
    if (existsSync(f)) {
      const t = readFileSync(f, "utf8").trim();
      if (t) return t;
    }
  }
  throw new Error("找不到令牌：请设置 MCPBRIDGE_TOKEN 或 MCPBRIDGE_CONFIG");
}
const TOKEN = resolveToken();

let rpcId = 0;
async function rpc(method, params) {
  const res = await fetch(`${URL_BASE}/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(`[${body.error.code}] ${body.error.message}`);
  return body.result;
}

// ---------------------------------------------------------------- 坐标与材质
const CX = -111;
const CY = -1; // 地表顶层
const CZ = -92;

const AIR = "minecraft:air";
const ST = "minecraft:stone_bricks";
const PA = "minecraft:polished_andesite";
const CSB = "minecraft:chiseled_stone_bricks";
const RC = "minecraft:red_concrete";
const DOL = "minecraft:dark_oak_log";
const DOP = "minecraft:dark_oak_planks";
const DOS = "minecraft:dark_oak_slab";
const DT = "minecraft:deepslate_tiles";
const OC = "minecraft:oxidized_copper";
const GP = "minecraft:glass_pane";
const LAN = "minecraft:lantern";
const SBW = "minecraft:stone_brick_wall";
const SBS = "minecraft:stone_brick_stairs";
const SBSL = "minecraft:stone_brick_slab";
const GOLD = "minecraft:gold_block";
const BELL = "minecraft:bell";
const BARREL = "minecraft:barrel";
const SPR_LOG = "minecraft:spruce_log";
const SPR_LEAF = "minecraft:spruce_leaves";

const AXIS_Y = { axis: "y" };
const NOT_HANGING = { hanging: "false" };

const ops = [];
const F = (u1, v1, h1, u2, v2, h2, block, props) => ops.push({ fill: 1, u1, v1, h1, u2, v2, h2, block, props });
const S = (u, v, h, block, props) => ops.push({ fill: 0, u, v, h, block, props });

// ---------------------------------------------------------------- 0. 清场（保证脚本幂等）
F(-28, -28, 1, 28, 34, 26, AIR);

// ---------------------------------------------------------------- 1. 铺地
F(-28, -28, 0, 28, 34, 0, ST);   // 庭院青砖
F(-3, -28, 0, 3, 34, 0, PA);     // 中轴甬道
F(-4, -28, 0, -4, 34, 0, CSB);   // 甬道边
F(4, -28, 0, 4, 34, 0, CSB);

// ---------------------------------------------------------------- 2. 围墙
for (const [a, b, c, d] of [
  [-28, -28, 28, -28], // 北
  [-28, 34, -15, 34],  // 南（西段，中为山门开口）
  [15, 34, 28, 34],    // 南（东段）
  [-28, -27, -28, 33], // 西
  [28, -27, 28, 33],   // 东
]) {
  F(a, b, 1, c, d, 1, PA); // 墙裙
  F(a, b, 2, c, d, 4, RC); // 红墙
  F(a, b, 5, c, d, 5, DT); // 瓦顶压顶
}

// ---------------------------------------------------------------- 3. 主殿（面阔 23 / 进深 15 / 台基 4 层）
F(-13, -24, 0, 13, -6, 2, ST);
F(-13, -24, 3, 13, -6, 3, PA);
F(-4, -5, 0, 4, -5, 2, PA);      // 踏步
F(-4, -4, 0, 4, -4, 1, PA);
F(-13, -24, 4, -13, -6, 4, SBW); // 石栏杆
F(13, -24, 4, 13, -6, 4, SBW);
F(-12, -24, 4, 12, -24, 4, SBW);
F(-13, -6, 4, -5, -6, 4, SBW);
F(5, -6, 4, 13, -6, 4, SBW);

for (const u of [-12, -8, -4, 4, 8, 12]) { F(u, -7, 4, u, -7, 11, DOL); F(u, -23, 4, u, -23, 11, DOL); }
for (const v of [-19, -15, -11]) { F(-12, v, 4, -12, v, 11, DOL); F(12, v, 4, 12, v, 11, DOL); }
F(0, -23, 4, 0, -23, 11, DOL);   // 后檐明间柱（前檐让开中门）

F(-11, -8, 4, 11, -8, 11, RC);   // 前檐墙
F(-11, -22, 4, 11, -22, 11, RC); // 后檐墙
F(-11, -21, 4, -11, -9, 11, RC); // 西山墙
F(11, -21, 4, 11, -9, 11, RC);   // 东山墙
F(-3, -8, 4, 3, -8, 10, AIR);    // 明间门洞
F(-11, -8, 4, -4, -8, 4, DOP);   // 裙板
F(4, -8, 4, 11, -8, 4, DOP);
F(-10, -8, 5, -4, -8, 10, GP);   // 隔扇门
F(4, -8, 5, 10, -8, 10, GP);
F(-11, -20, 5, -11, -18, 10, GP); // 侧窗
F(-11, -14, 5, -11, -12, 10, GP);
F(11, -20, 5, 11, -18, 10, GP);
F(11, -14, 5, 11, -12, 10, GP);
F(-9, -22, 5, -5, -22, 10, GP);  // 后窗
F(5, -22, 5, 9, -22, 10, GP);
F(-2, -8, 11, 2, -8, 11, GOLD);  // 匾额
F(-12, -23, 12, 12, -7, 12, DOP); // 额枋
F(-14, -25, 13, 14, -5, 13, DOS); // 斗拱层
F(-15, -26, 14, 15, -4, 14, DT);  // 屋檐（出檐）
F(-13, -24, 15, 13, -6, 15, DT);
F(-11, -22, 16, 11, -8, 16, DT);
F(-8, -19, 17, 8, -11, 17, DT);
F(-5, -17, 18, 5, -13, 18, DT);
F(-13, -15, 19, 13, -15, 19, OC); // 正脊
F(-11, -22, 16, -11, -8, 16, OC); // 垂脊
F(11, -22, 16, 11, -8, 16, OC);
F(-13, -24, 15, -13, -6, 15, OC);
F(13, -24, 15, 13, -6, 15, OC);
S(-13, -15, 20, OC); S(13, -15, 20, OC); // 鸱吻
for (const [u, v] of [[-15, -26], [-15, -4], [15, -26], [15, -4]]) {
  S(u, v, 15, OC); S(u, v, 16, OC); // 飞檐翘角
}
S(-6, -7, 4, LAN, NOT_HANGING); S(6, -7, 4, LAN, NOT_HANGING);
S(0, -2, 1, PA); S(0, -2, 2, ST); S(0, -2, 3, CSB); S(0, -2, 4, SBSL); // 丹墀香炉

// ---------------------------------------------------------------- 4. 东西配殿（对称）
for (const sgn of [-1, 1]) {
  const M = (u) => (sgn < 0 ? u : -u);
  const R = (u1, u2) => { const a = M(u1), b = M(u2); return [Math.min(a, b), Math.max(a, b)]; };
  const [p0, p1] = R(-25, -13);   // 台基
  const [b0, b1] = R(-24, -14);   // 主体
  const [d0, d1] = R(-26, -12);   // 斗拱
  const [e0, e1] = R(-27, -11);   // 屋檐
  const [r0, r1] = R(-22, -16);   // 上层屋面
  const [w0, w1] = R(-23, -17);   // 山墙窗
  const outU = M(-24);   // 背朝中轴的一侧
  const doorU = M(-14);  // 朝向中轴的一侧（开门）
  const stepU = M(-12);
  const ridgeU = M(-19);
  const lanU = M(-13);

  F(p0, 1, 0, p1, 15, 1, ST);
  F(p0, 1, 2, p1, 15, 2, PA);
  F(stepU, 6, 0, stepU, 8, 1, PA);

  F(b0, 2, 3, b1, 2, 6, RC);      // 山墙
  F(b0, 14, 3, b1, 14, 6, RC);
  F(outU, 3, 3, outU, 13, 6, RC);   // 外侧檐墙
  F(doorU, 3, 3, doorU, 13, 6, RC); // 内侧檐墙（朝中轴）
  F(doorU, 6, 3, doorU, 8, 6, AIR); // 门洞

  for (const [uu, vv] of [[-24, 2], [-14, 2], [-24, 14], [-14, 14], [-19, 2], [-19, 14], [-24, 8], [-14, 5], [-14, 9]]) {
    F(M(uu), vv, 3, M(uu), vv, 6, DOL); // 檐柱
  }
  F(w0, 2, 4, w1, 2, 5, GP);
  F(w0, 14, 4, w1, 14, 5, GP);
  F(doorU, 2, 4, doorU, 4, 5, GP);
  F(doorU, 10, 4, doorU, 12, 5, GP);

  F(p0, 1, 7, p1, 15, 7, DOP);    // 额枋
  F(d0, 0, 8, d1, 16, 8, DOS);    // 斗拱
  F(e0, -1, 9, e1, 17, 9, DT);    // 屋檐
  F(p0, 1, 10, p1, 15, 10, DT);
  F(r0, 4, 11, r1, 12, 11, DT);
  F(ridgeU, 1, 12, ridgeU, 15, 12, OC); // 正脊
  F(p0, 1, 10, p1, 1, 10, OC);    // 垂脊
  F(p0, 15, 10, p1, 15, 10, OC);
  for (const [eu, ev] of [[e0, -1], [e0, 17], [e1, -1], [e1, 17]]) S(eu, ev, 10, OC); // 翘角
  S(lanU, 4, 3, LAN, NOT_HANGING);
  S(lanU, 10, 3, LAN, NOT_HANGING);
}

// ---------------------------------------------------------------- 5. 钟楼（东）/ 鼓楼（西）
for (const sgn of [-1, 1]) {
  const M = (u) => (sgn < 0 ? u : -u);
  const R = (u1, u2) => { const a = M(u1), b = M(u2); return [Math.min(a, b), Math.max(a, b)]; };
  const [pl0, pl1] = R(-25, -17);   // 台基
  const [bd0, bd1] = R(-24, -18);   // 一层主体
  const [dg0, dg1] = R(-26, -16);   // 一层斗拱
  const [ev0, ev1] = R(-27, -15);   // 一层屋檐
  const [up0, up1] = R(-26, -16);   // 一层檐上
  const [t0, t1] = R(-23, -19);     // 二层主体
  const [q0, q1] = R(-24, -18);     // 二层斗拱
  const [t2e0, t2e1] = R(-25, -17); // 二层屋檐
  const [t2u0, t2u1] = R(-23, -19); // 二层檐上
  const [py0, py1] = R(-22, -20);   // 攒尖
  const stepU = M(-16);
  const ctrU = M(-21);

  F(pl0, 24, 0, pl1, 30, 1, ST);
  F(pl0, 24, 2, pl1, 30, 2, PA);
  F(stepU, 26, 0, stepU, 28, 1, PA);

  F(bd0, 25, 3, bd1, 25, 4, RC);    // 一层槛墙
  F(bd0, 29, 3, bd1, 29, 4, RC);
  F(bd0, 26, 3, bd0, 28, 4, RC);
  F(bd1, 26, 3, bd1, 28, 4, RC);
  for (const [uu, vv] of [[-24, 25], [-18, 25], [-24, 29], [-18, 29], [-21, 25], [-21, 29], [-24, 27], [-18, 27]]) {
    F(M(uu), vv, 3, M(uu), vv, 5, DOL); // 一层柱
  }
  F(pl0, 24, 6, pl1, 30, 6, DOP);   // 一层额枋
  F(dg0, 23, 7, dg1, 31, 7, DOS);
  F(ev0, 22, 8, ev1, 32, 8, DT);    // 一层屋檐
  F(up0, 23, 9, up1, 31, 9, DT);
  for (const [eu, ev] of [[ev0, 22], [ev0, 32], [ev1, 22], [ev1, 32]]) S(eu, ev, 9, OC);

  F(t0, 25, 10, t1, 25, 11, RC);    // 二层槛墙
  F(t0, 29, 10, t1, 29, 11, RC);
  F(t0, 26, 10, t0, 28, 11, RC);
  F(t1, 26, 10, t1, 28, 11, RC);
  for (const [uu, vv] of [[-23, 25], [-19, 25], [-23, 29], [-19, 29], [-21, 25], [-21, 29]]) {
    F(M(uu), vv, 10, M(uu), vv, 12, DOL); // 二层柱
  }
  F(t0, 25, 13, t1, 29, 13, DOP);
  F(q0, 24, 14, q1, 30, 14, DOS);
  F(t2e0, 23, 15, t2e1, 31, 15, DT); // 二层屋檐
  F(t2u0, 25, 16, t2u1, 29, 16, DT);
  F(py0, 26, 17, py1, 28, 17, DT);  // 攒尖顶
  S(ctrU, 27, 18, GOLD);            // 宝顶
  for (const [eu, ev] of [[t2e0, 23], [t2e0, 31], [t2e1, 23], [t2e1, 31]]) S(eu, ev, 16, OC);

  if (sgn > 0) S(ctrU, 27, 12, BELL, { attachment: "ceiling", facing: "north" }); // 东侧钟楼
  else S(ctrU, 27, 10, BARREL, { facing: "north", open: "false" });               // 西侧鼓楼
}

// ---------------------------------------------------------------- 6. 山门
F(-12, 25, 0, 12, 31, 1, ST);
F(-12, 25, 2, 12, 31, 2, PA);
F(-4, 32, 0, 4, 32, 1, PA);      // 前踏步
F(-4, 24, 0, 4, 24, 1, PA);      // 后踏步
F(-11, 26, 3, 11, 26, 6, RC);
F(-11, 30, 3, 11, 30, 6, RC);
for (const u of [-11, 11]) F(u, 27, 3, u, 29, 6, RC);
F(-4, 26, 3, 4, 30, 6, AIR);     // 中门洞
for (const u of [-11, 11, -5, 5]) { F(u, 26, 3, u, 26, 6, DOL); F(u, 30, 3, u, 30, 6, DOL); }
F(-10, 26, 4, -7, 26, 5, GP); F(7, 26, 4, 10, 26, 5, GP);
F(-10, 30, 4, -7, 30, 5, GP); F(7, 30, 4, 10, 30, 5, GP);
F(-12, 25, 7, 12, 31, 7, DOP);   // 额枋
F(-3, 30, 7, 3, 30, 7, GOLD);    // 匾额
F(-13, 24, 8, 13, 32, 8, DOS);
F(-14, 23, 9, 14, 33, 9, DT);    // 屋檐
F(-12, 25, 10, 12, 31, 10, DT);
F(-9, 26, 11, 9, 30, 11, DT);
F(-6, 27, 12, 6, 29, 12, DT);
F(-9, 28, 13, 9, 28, 13, OC);    // 正脊
for (const u of [-9, 9]) F(u, 26, 11, u, 30, 11, OC);
for (const u of [-12, 12]) F(u, 25, 10, u, 31, 10, OC);
for (const [u, v] of [[-14, 23], [-14, 33], [14, 23], [14, 33]]) { S(u, v, 10, OC); S(u, v, 11, OC); }
S(-8, 31, 3, LAN, NOT_HANGING); S(8, 31, 3, LAN, NOT_HANGING);

for (const u of [-7, 7]) {        // 石狮一对
  S(u, 32, 1, PA);
  S(u, 32, 2, ST);
  S(u, 32, 3, SBS, { facing: "south" });
}

// ---------------------------------------------------------------- 7. 松树
for (const [u, v] of [[-20, -2], [20, -2], [-20, 20], [20, 20], [-10, 20], [10, 20]]) {
  F(u, v, 1, u, v, 4, SPR_LOG, AXIS_Y);
  F(u - 2, v - 2, 5, u + 2, v + 2, 5, SPR_LEAF);
  F(u - 1, v - 1, 6, u + 1, v + 1, 6, SPR_LEAF);
  S(u, v, 7, SPR_LEAF);
}

// ---------------------------------------------------------------- 执行
const MAX_VOL = 30000; // 模组 maxFillVolume = 32768
const world = (u, v, h) => ({ x: CX + u, y: CY + h, z: CZ + v });

let ok = 0;
let failed = 0;
let blocks = 0;

async function runBox(op, r) {
  const vol = (r.x2 - r.x1 + 1) * (r.y2 - r.y1 + 1) * (r.z2 - r.z1 + 1);
  if (op.fill && vol > MAX_VOL) {
    const dx = r.x2 - r.x1, dy = r.y2 - r.y1, dz = r.z2 - r.z1;
    const mid = (lo, hi) => lo + Math.floor((hi - lo) / 2);
    if (dx >= dy && dx >= dz) {
      const m = mid(r.x1, r.x2);
      await runBox(op, { ...r, x2: m });
      await runBox(op, { ...r, x1: m + 1 });
    } else if (dy >= dz) {
      const m = mid(r.y1, r.y2);
      await runBox(op, { ...r, y2: m });
      await runBox(op, { ...r, y1: m + 1 });
    } else {
      const m = mid(r.z1, r.z2);
      await runBox(op, { ...r, z2: m });
      await runBox(op, { ...r, z1: m + 1 });
    }
    return;
  }
  const params = { block: op.block };
  if (op.props) params.properties = op.props;
  try {
    const res = op.fill
      ? await rpc("fill_blocks", { x1: r.x1, y1: r.y1, z1: r.z1, x2: r.x2, y2: r.y2, z2: r.z2, ...params })
      : await rpc("set_block", { x: r.x1, y: r.y1, z: r.z1, ...params });
    const changed = res.changed ?? 1;
    blocks += changed;
    if (op.fill && changed === 0) { failed++; console.log(`  ! 无变化 ${op.block} @${r.x1},${r.y1},${r.z1}`); }
    else ok++;
  } catch (e) {
    failed++;
    console.log(`  ✗ ${op.block} @${r.x1},${r.y1},${r.z1}: ${String(e.message).slice(0, 100)}`);
  }
}

async function runOp(op) {
  const a = world(op.fill ? op.u1 : op.u, op.fill ? op.v1 : op.v, op.fill ? op.h1 : op.h);
  const b = world(op.fill ? op.u2 : op.u, op.fill ? op.v2 : op.v, op.fill ? op.h2 : op.h);
  await runBox(op, {
    x1: Math.min(a.x, b.x), x2: Math.max(a.x, b.x),
    y1: Math.min(a.y, b.y), y2: Math.max(a.y, b.y),
    z1: Math.min(a.z, b.z), z2: Math.max(a.z, b.z),
  });
}

console.log(`中心 (${CX}, ${CY}, ${CZ})｜场地 57 × 63｜共 ${ops.length} 个操作\n`);
for (const op of ops) await runOp(op);
console.log(`\n完成：成功 ${ok}，异常 ${failed}，实际改动方块 ${blocks}`);
