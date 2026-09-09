#!/usr/bin/env node
// 建造框架：把「局部坐标」的建造指令批量送到游戏内桥。
//
// 坐标约定（世界坐标固定，便于反复调整设计）：
//   x = -180 + u   （u 为横向偏移，+u 向东）
//   z =   66 + v   （v 为纵深，0 在鸟居入口，负值往北/往内）
//   y 直接给世界 y。
//
// 用法：被 build-shrine2.mjs import。

import { rpc } from "../mc.mjs";

export const CX = -180; // 主轴线 x
export const V0 = 104; // 参道入口 z（v=0 就是最南端的第一座大鸟居）
export const MAX_FILL = 32000;

export const wx = (u) => CX + u;
export const wz = (v) => V0 + v;

// ---------------------------------------------------------------- 场地高程
// 内院（z <= -16）统一 y=63；参道自内院向南每 12 格降 1 格，直到 z=104 的 y=73。
// 也就是「从入口走到本殿，一路拾级而上」。
export const INNER_Z = -16;
export const BASE_HIGH = 63; // 内院台面
export const BASE_LOW = 73; // 最南端（入口）台面
export const levelAt = (v) => {
  const z = wz(v);
  if (z <= INNER_Z) return BASE_HIGH;
  return Math.min(BASE_LOW, BASE_HIGH + Math.ceil((z - INNER_Z) / 12));
};

const stats = { fill: 0, set: 0, vol: 0, err: 0 };
export const getStats = () => ({ ...stats });

/** 判断坐标是否在目标区域内（避免误改远处地形） */
export function box(u1, v1, y1, u2, v2, y2) {
  return {
    x1: Math.min(wx(u1), wx(u2)),
    x2: Math.max(wx(u1), wx(u2)),
    z1: Math.min(wz(v1), wz(v2)),
    z2: Math.max(wz(v1), wz(v2)),
    y1: Math.min(y1, y2),
    y2: Math.max(y1, y2),
  };
}

/** 区域填充（自动按体积切片），block 可带 properties */
export async function fill(u1, v1, y1, u2, v2, y2, block, props) {
  const b = box(u1, v1, y1, u2, v2, y2);
  const vy = b.y2 - b.y1 + 1;
  const vz = b.z2 - b.z1 + 1;
  const vx = b.x2 - b.x1 + 1;
  if (vx <= 0 || vy <= 0 || vz <= 0) return;
  const sliceZ = Math.max(1, Math.floor(MAX_FILL / (vx * vy)));
  for (let z = b.z1; z <= b.z2; z += sliceZ) {
    const zEnd = Math.min(b.z2, z + sliceZ - 1);
    const params = { x1: b.x1, y1: b.y1, z1: z, x2: b.x2, y2: b.y2, z2: zEnd, block };
    if (props) params.properties = props;
    try {
      const r = await rpc("fill_blocks", params);
      stats.fill++;
      stats.vol += r.changed ?? 0;
    } catch (e) {
      stats.err++;
      console.error(`  ✗ fill ${block} u[${u1}..${u2}] v[${v1}..${v2}] y[${y1}..${y2}]: ${e.message}`);
    }
  }
}

export async function set(u, v, y, block, props) {
  const params = { x: wx(u), y, z: wz(v), block };
  if (props) params.properties = props;
  try {
    await rpc("set_block", params);
    stats.set++;
  } catch (e) {
    stats.err++;
    console.error(`  ✗ set ${block} @u${u} v${v} y${y}: ${e.message}`);
  }
}

/** 同一层重复放一排（沿 u 方向） */
export async function rowU(u1, u2, v, y, block, props) {
  for (let u = Math.min(u1, u2); u <= Math.max(u1, u2); u++) await set(u, v, y, block, props);
}
/** 同一层重复放一排（沿 v 方向） */
export async function rowV(v1, v2, u, y, block, props) {
  for (let v = Math.min(v1, v2); v <= Math.max(v1, v2); v++) await set(u, v, y, block, props);
}

/** 矩形环（墙/框），厚度 1 */
export async function ring(u1, v1, u2, v2, y, block, props) {
  await fill(u1, v1, y, u2, v1, y, block, props);
  await fill(u1, v2, y, u2, v2, y, block, props);
  await fill(u1, v1, y, u1, v2, y, block, props);
  await fill(u2, v1, y, u2, v2, y, block, props);
}

export const printStats = (label = "合计") =>
  console.log(`${label}: fill=${stats.fill} set=${stats.set} 体积=${stats.vol} 错误=${stats.err}`);
