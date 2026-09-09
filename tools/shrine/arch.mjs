#!/usr/bin/env node
// 通用建筑构件：鸟居、切妻造/入母屋造屋顶、石灯笼、狛犬、注连绳等。
//
// 坐标约定见 lib.mjs：u 横向（+东），v 纵深（0 = 参道最南端，负值往内），y 为世界高度。

import { fill, set, ring, wx, wz, levelAt } from "./lib.mjs";

// ---------------------------------------------------------------- 材质
export const M = {
  post: "minecraft:dark_oak_log", // 柱
  beam: "minecraft:dark_oak_planks", // 梁、枋
  beam2: "minecraft:pale_oak_planks", // 浅色木作
  wall: "minecraft:white_concrete", // 白壁
  wall2: "minecraft:white_terracotta", // 白壁（次）
  lattice: "minecraft:dark_oak_trapdoor", // 格子窗
  floor: "minecraft:dark_oak_planks", // 殿内地板
  roof: "minecraft:dark_prismarine", // 屋根（瓦）
  roof2: "minecraft:deepslate_tiles", // 屋根（次）
  ridge: "minecraft:polished_deepslate", // 屋脊
  stone: "minecraft:stone_bricks", // 石基座
  stone2: "minecraft:polished_andesite",
  stone3: "minecraft:cobblestone",
  path: "minecraft:andesite",
  rope: "minecraft:white_concrete", // 注连绳
  rope2: "minecraft:white_wool",
  gold: "minecraft:gold_block",
  lamp: "minecraft:lantern",
  lampS: "minecraft:soul_lantern",
  water: "minecraft:water",
  glass: "minecraft:glass_pane",
  gravel: "minecraft:gravel",
  moss: "minecraft:moss_block",
  chiseled: "minecraft:chiseled_stone_bricks",
};

/** 台阶方块名：把任意方块映射到对应的楼梯 ID */
export const stairOf = (block) => {
  const id = block.replace(/^minecraft:/, "");
  const map = {
    dark_prismarine: "dark_prismarine_stairs",
    deepslate_tiles: "deepslate_tile_stairs",
    stone_bricks: "stone_brick_stairs",
    polished_andesite: "polished_andesite_stairs",
    andesite: "andesite_stairs",
    cobblestone: "cobblestone_stairs",
    white_concrete: "white_concrete_stairs",
    white_terracotta: "white_terracotta_stairs",
    polished_deepslate: "polished_deepslate_stairs",
  };
  if (map[id]) return `minecraft:${map[id]}`;
  if (id.endsWith("_planks")) return `minecraft:${id.replace(/_planks$/, "_stairs")}`;
  if (id.endsWith("_bricks")) return `minecraft:${id.replace(/_bricks$/, "_brick_stairs")}`;
  return `minecraft:${id}_stairs`;
};

// ---------------------------------------------------------------- 鸟居
/**
 * 明神鸟居。u 为中心横向坐标，v 为所在纵深，baseY 为地面高度，halfW 为柱心半间距。
 * 返回结构顶部 y，便于挂注连绳。
 */
export async function torii(u, v, baseY, halfW, opts = {}) {
  const mat = opts.mat ?? M.post;
  const beamMat = opts.beam ?? M.beam;
  const h = opts.height ?? Math.round(halfW * 1.5) + 5; // 柱高
  const uL = u - halfW;
  const uR = u + halfW;

  // 柱（两根，带础石）
  for (const uu of [uL, uR]) {
    await fill(uu, v, baseY, uu, v, baseY, M.stone2);
    await fill(uu, v, baseY + 1, uu, v, baseY + h, mat);
  }

  const nuki = baseY + h - 3; // 贯
  const shimagi = baseY + h + 1; // 岛木
  const kasagi = baseY + h + 2; // 笠木

  // 贯：略窄于柱
  await fill(uL, v, nuki, uR, v, nuki, beamMat);
  // 额束（中央小柱）
  await fill(u, v, nuki + 1, u, v, shimagi - 1, beamMat);
  // 岛木：比柱宽 1 格
  await fill(uL - 1, v, shimagi, uR + 1, v, shimagi, beamMat);
  // 笠木：比岛木再宽 1 格，两端微微上翘
  await fill(uL - 2, v, kasagi, uR + 2, v, kasagi, mat);
  await fill(uL - 2, v, kasagi + 1, uL - 2, v, kasagi + 1, mat);
  await fill(uR + 2, v, kasagi + 1, uR + 2, v, kasagi + 1, mat);

  // 注连绳（挂在贯下方）
  if (opts.rope !== false) {
    await fill(uL + 1, v, nuki - 1, uR - 1, v, nuki - 1, M.rope);
    await fill(uL + 1, v, nuki - 2, uR - 1, v, nuki - 2, M.rope2);
    // 纸垂（白色垂饰）
    for (let uu = uL + 2; uu <= uR - 2; uu += 3) {
      await set(uu, v, nuki - 3, M.rope);
    }
  }
  return kasagi + 1;
}

// ---------------------------------------------------------------- 屋顶
/**
 * 切妻造（双坡顶）：屋脊沿 v 方向（南北），两坡朝东西。
 * u1..u2 / v1..v2 是建筑外墙范围，eaveY 是屋檐所在高度。
 * 坡度 1:2（每收进 2 格抬升 1 格），接近日式木造屋顶的实际坡度。
 */
export async function roofKirizuma(u1, u2, v1, v2, eaveY, opts = {}) {
  const mat = opts.mat ?? M.roof;
  const ridgeMat = opts.ridge ?? M.ridge;
  const midL = Math.floor((u1 + u2) / 2);
  const midR = midL + 1;
  const halfSpan = Math.ceil((u2 - u1) / 2);
  const layers = Math.max(1, Math.ceil(halfSpan / 2));

  for (let i = 0; i < layers; i++) {
    const a = u1 - i * 2;
    const b = u2 + i * 2;
    const y = eaveY + i;
    if (a >= b) {
      await fill(midL, v1, y, midR, v2, y, ridgeMat);
      break;
    }
    // 西坡：台阶朝东（向屋脊抬升）；东坡朝西
    await fill(a, v1, y, a, v2, y, stairOf(mat), { facing: "east" });
    await fill(b, v1, y, b, v2, y, stairOf(mat), { facing: "west" });
    if (b - a > 1) await fill(a + 1, v1, y, b - 1, v2, y, mat);
  }

  // 屋脊压顶
  const ridgeY = eaveY + layers;
  await fill(midL, v1, ridgeY, midR, v2, ridgeY, ridgeMat);
  return ridgeY;
}

/**
 * 入母屋造（歇山）：下部四面坡、上部切妻脊。用在最重要的本殿/拝殿。
 * 同样按 1:2 坡度，下部每层同时收 u 和 v。
 */
export async function roofIrimoya(u1, u2, v1, v2, eaveY, opts = {}) {
  const mat = opts.mat ?? M.roof;
  const ridgeMat = opts.ridge ?? M.ridge;
  const midL = Math.floor((u1 + u2) / 2);
  const midR = midL + 1;
  const halfU = Math.ceil((u2 - u1) / 2);
  const halfV = Math.ceil((v2 - v1) / 2);
  const layers = Math.max(1, Math.min(Math.ceil(halfU / 2), Math.ceil(halfV / 2)));

  let i = 0;
  for (; i < layers; i++) {
    const a = u1 - i * 2;
    const b = u2 + i * 2;
    const c = v1 - i * 2;
    const d = v2 + i * 2;
    const y = eaveY + i;
    if (a >= b || c >= d) break;
    // 东西坡
    await fill(a, c, y, a, d, y, stairOf(mat), { facing: "east" });
    await fill(b, c, y, b, d, y, stairOf(mat), { facing: "west" });
    // 南北坡
    await fill(a + 1, c, y, b - 1, c, y, stairOf(mat), { facing: "south" });
    await fill(a + 1, d, y, b - 1, d, y, stairOf(mat), { facing: "north" });
    if (b - a > 1 && d - c > 1) await fill(a + 1, c + 1, y, b - 1, d - 1, y, mat);
  }
  // 上部切妻脊（沿 v 方向）
  const y = eaveY + i;
  await fill(midL, v1 + 1, y, midR, v2 - 1, y, ridgeMat);
  await fill(midL, v1 + 1, y + 1, midR, v2 - 1, y + 1, ridgeMat);
  return y + 1;
}

// ---------------------------------------------------------------- 石灯笼
/** 春日灯笼：础 / 竿 / 中台 / 火袋 / 笠 / 宝顶 */
export async function stoneLantern(u, v, baseY, opts = {}) {
  const lit = opts.lit !== false;
  const s = opts.small === true;
  const st = opts.stone ?? M.stone;
  await fill(u, v, baseY, u, v, baseY, st); // 础
  if (s) {
    await fill(u, v, baseY + 1, u, v, baseY + 1, "minecraft:stone_brick_wall");
    await fill(u, v, baseY + 2, u, v, baseY + 2, lit ? M.lamp : st);
    await fill(u, v, baseY + 3, u, v, baseY + 3, "minecraft:stone_brick_slab");
    return baseY + 3;
  }
  await fill(u, v, baseY + 1, u, v, baseY + 2, "minecraft:stone_brick_wall"); // 竿
  await fill(u, v, baseY + 3, u, v, baseY + 3, "minecraft:chiseled_stone_bricks"); // 中台
  await fill(u, v, baseY + 4, u, v, baseY + 4, lit ? M.lamp : st); // 火袋
  await fill(u, v, baseY + 5, u, v, baseY + 5, "minecraft:stone_brick_slab"); // 笠
  await fill(u, v, baseY + 6, u, v, baseY + 6, "minecraft:chiseled_stone_bricks"); // 宝顶
  return baseY + 6;
}

// ---------------------------------------------------------------- 狛犬 / 狐狸
/** 石造守护兽：台座 + 躯干 + 头，facing 为朝向 */
export async function guardian(u, v, baseY, facing = "south", opts = {}) {
  const st = opts.stone ?? M.stone;
  const body = opts.body ?? "minecraft:stone_bricks";
  await fill(u - 1, v - 1, baseY, u + 1, v + 1, baseY, st); // 台座
  await fill(u - 1, v - 1, baseY + 1, u + 1, v + 1, baseY + 1, "minecraft:chiseled_stone_bricks");
  await fill(u, v, baseY + 2, u, v, baseY + 2, body); // 躯干
  await fill(u, v, baseY + 3, u, v, baseY + 3, body); // 头
  // 耳朵/尾
  await set(u, v, baseY + 4, "minecraft:stone_brick_slab");
  const d = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[facing] ?? [0, 1];
  await set(u + d[0], v + d[1], baseY + 2, "minecraft:cobblestone_wall");
  return baseY + 4;
}

// ---------------------------------------------------------------- 注连绳
/** 在两柱之间挂一条注连绳 + 纸垂 */
export async function shimenawa(u1, u2, v, y) {
  await fill(u1, v, y, u2, v, y, M.rope);
  await fill(u1, v, y - 1, u2, v, y - 1, M.rope2);
  for (let u = u1 + 1; u <= u2 - 1; u += 2) await set(u, v, y - 2, M.rope);
  await fill(u1, v, y, u1, v, y, M.rope2);
  await fill(u2, v, y, u2, v, y, M.rope2);
}

// ---------------------------------------------------------------- 围墙 / 玉垣
/** 玉垣：石柱 + 横梁，带透空 */
export async function tamagaki(u1, v1, u2, v2, baseY, opts = {}) {
  const post = opts.post ?? M.stone;
  const rail = opts.rail ?? M.stone2;
  const h = opts.height ?? 2;
  const isH = Math.abs(u2 - u1) >= Math.abs(v2 - v1);
  if (isH) {
    for (let u = Math.min(u1, u2); u <= Math.max(u1, u2); u++) {
      await fill(u, v1, baseY + 1, u, v1, baseY + h, rail);
      if ((u - Math.min(u1, u2)) % 3 === 0) await fill(u, v1, baseY + 1, u, v1, baseY + h + 1, post);
    }
  } else {
    for (let v = Math.min(v1, v2); v <= Math.max(v1, v2); v++) {
      await fill(u1, v, baseY + 1, u1, v, baseY + h, rail);
      if ((v - Math.min(v1, v2)) % 3 === 0) await fill(u1, v, baseY + 1, u1, v, baseY + h + 1, post);
    }
  }
}
