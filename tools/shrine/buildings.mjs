#!/usr/bin/env node
// 神社主要殿舍：本殿、币殿、拝殿、楼门、社务所、神馔所、钟楼。
//
// 全部以「中心线 u=0」为轴对称布置，v 为纵深（负值往内/北）。

import { fill, set, ring } from "./lib.mjs";
import { M, roofKirizuma, roofIrimoya, stairOf, shimenawa } from "./arch.mjs";

/** 通用石基座 + 台阶 */
async function podium(u1, u2, v1, v2, topY, opts = {}) {
  const mat = opts.mat ?? M.stone;
  await fill(u1, v1, topY, u2, v2, topY, mat);
  await fill(u1, v1, topY - 1, u2, v2, topY - 1, M.stone2);
}

/** 四面墙（木柱 + 白壁 + 透空窗） */
async function walls(u1, u2, v1, v2, y1, y2, opts = {}) {
  const wallMat = opts.wall ?? M.wall;
  const postMat = opts.post ?? M.post;
  const h = y2 - y1 + 1;
  // 先铺满白壁
  await ring(u1, v1, u2, v2, y1, wallMat);
  for (let y = y1 + 1; y <= y2; y++) await ring(u1, v1, u2, v2, y, wallMat);
  // 四角柱
  for (const [uu, vv] of [[u1, v1], [u1, v2], [u2, v1], [u2, v2]]) {
    await fill(uu, vv, y1, uu, vv, y2, postMat);
  }
  // 每隔 4 格一根侧柱
  for (let u = u1 + 4; u <= u2 - 4; u += 4) {
    await fill(u, v1, y1, u, v1, y2, postMat);
    await fill(u, v2, y1, u, v2, y2, postMat);
  }
  for (let v = v1 + 4; v <= v2 - 4; v += 4) {
    await fill(u1, v, y1, u1, v, y2, postMat);
    await fill(u2, v, y1, u2, v, y2, postMat);
  }
  // 横向长押（腰线）
  if (h >= 3) {
    const midY = y1 + Math.floor(h / 2);
    await ring(u1, v1, u2, v2, midY, M.beam);
  }
  return { h };
}

/** 格子窗 */
async function windows(u1, u2, v, y, opts = {}) {
  const mat = opts.mat ?? M.lattice;
  for (let u = u1; u <= u2; u++) {
    await set(u, v, y, mat, { facing: opts.facing ?? "south", half: "top" });
  }
}

// ---------------------------------------------------------------- 本殿
/** 本殿：切妻造，三间社，带千木与坚鱼木 */
export async function honden() {
  const u1 = -10, u2 = 10, v1 = -180, v2 = -164;
  const floorY = 64;
  const wallY1 = 65, wallY2 = 69;
  const eaveY = 70;

  await podium(u1 - 1, u2 + 1, v1 - 1, v2 + 1, floorY);
  // 正面台阶（南侧）
  await fill(-3, v2 + 1, floorY, 3, v2 + 2, floorY, M.stone);
  await fill(-3, v2 + 2, floorY - 1, 3, v2 + 2, floorY - 1, M.stone2);
  await fill(-3, v2 + 1, floorY - 1, 3, v2 + 1, floorY - 1, M.stone2);

  await walls(u1, u2, v1, v2, wallY1, wallY2);
  // 殿内地板
  await fill(u1 + 1, v1 + 1, floorY, u2 - 1, v2 - 1, floorY, M.floor);

  // 正面御扉（三间）
  await fill(-2, v2, wallY1, 2, v2, wallY1 + 2, M.beam);
  await fill(-2, v2, wallY1 + 3, 2, v2, wallY1 + 3, M.lattice, { facing: "south", half: "top" });
  await fill(-6, v2, wallY1 + 1, -4, v2, wallY1 + 2, M.lattice, { facing: "south", half: "top" });
  await fill(4, v2, wallY1 + 1, 6, v2, wallY1 + 2, M.lattice, { facing: "south", half: "top" });
  // 侧窗
  await windows(u1, u1, v1 + 4, wallY1 + 2, { facing: "east", mat: M.lattice });

  // 缘（回廊栏杆）
  await ring(u1 - 1, v1 - 1, u2 + 1, v2 + 1, floorY + 1, M.beam);
  for (let u = u1 - 1; u <= u2 + 1; u++) {
    if ((u - u1) % 3 === 0) await fill(u, v1 - 1, floorY + 1, u, v1 - 1, floorY + 2, M.post);
  }

  // 屋顶：切妻造
  const ridgeY = await roofKirizuma(u1, u2, v1 - 1, v2 + 1, eaveY, { mat: M.roof, ridge: M.ridge });
  // 千木（屋脊两端交叉木）
  for (const vv of [v1 - 1, v2 + 1]) {
    await fill(-1, vv, ridgeY + 1, -1, vv, ridgeY + 2, M.beam);
    await fill(0, vv, ridgeY + 1, 0, vv, ridgeY + 2, M.beam);
  }
  // 坚鱼木（屋脊上的短木）
  for (let vv = v1 + 2; vv <= v2 - 2; vv += 5) {
    await fill(-1, vv, ridgeY + 1, 1, vv, ridgeY + 1, M.beam);
  }
  // 正面注连绳
  await shimenawa(-4, 4, v2 + 1, wallY2 + 1);
  return ridgeY;
}

// ---------------------------------------------------------------- 币殿
export async function heiden() {
  const u1 = -4, u2 = 4, v1 = -164, v2 = -156;
  const floorY = 64;
  await podium(u1 - 1, u2 + 1, v1, v2, floorY);
  await walls(u1, u2, v1, v2, 65, 68);
  await fill(u1 + 1, v1 + 1, floorY, u2 - 1, v2 - 1, floorY, M.floor);
  await fill(-2, v2, 65, 2, v2, 66, M.beam);
  const ridgeY = await roofKirizuma(u1, u2, v1, v2, 69, { mat: M.roof2, ridge: M.ridge });
  return ridgeY;
}

// ---------------------------------------------------------------- 拝殿
/** 拝殿：入母屋造，带向拜（正面突出的屋檐） */
export async function haiden() {
  const u1 = -11, u2 = 11, v1 = -156, v2 = -144;
  const floorY = 64;
  const wallY1 = 65, wallY2 = 69;

  await podium(u1 - 1, u2 + 1, v1 - 1, v2 + 3, floorY);
  // 正面大台阶
  await fill(-5, v2 + 3, floorY, 5, v2 + 4, floorY, M.stone);
  await fill(-5, v2 + 4, floorY - 1, 5, v2 + 4, floorY - 1, M.stone2);
  await fill(-5, v2 + 3, floorY - 1, 5, v2 + 3, floorY - 1, M.stone2);

  await walls(u1, u2, v1, v2, wallY1, wallY2);
  await fill(u1 + 1, v1 + 1, floorY, u2 - 1, v2 - 1, floorY, M.floor);

  // 正面：中央大门 + 两侧格子窗
  await fill(-2, v2, wallY1, 2, v2, wallY2 - 1, M.beam);
  await fill(-1, v2, wallY1 + 1, 1, v2, wallY2 - 1, "minecraft:air");
  await fill(-7, v2, wallY1 + 1, -4, v2, wallY2 - 1, M.lattice, { facing: "south", half: "top" });
  await fill(4, v2, wallY1 + 1, 7, v2, wallY2 - 1, M.lattice, { facing: "south", half: "top" });
  // 侧面
  await fill(u1, v1 + 3, wallY1 + 1, u1, v2 - 3, wallY1 + 2, M.lattice, { facing: "east", half: "top" });
  await fill(u2, v1 + 3, wallY1 + 1, u2, v2 - 3, wallY1 + 2, M.lattice, { facing: "west", half: "top" });

  // 向拜：正面伸出的柱廊
  for (const uu of [-8, -4, 4, 8]) {
    await fill(uu, v2 + 2, floorY, uu, v2 + 2, wallY2, M.post);
  }
  await fill(-8, v2 + 2, wallY2, 8, v2 + 2, wallY2, M.beam);

  const ridgeY = await roofIrimoya(u1, u2, v1, v2, wallY2 + 1, { mat: M.roof, ridge: M.ridge });
  // 向拜屋顶
  await roofKirizuma(-9, 9, v2, v2 + 2, wallY2 + 1, { mat: M.roof2, ridge: M.ridge });
  // 正面注连绳 + 纸垂
  await shimenawa(-7, 7, v2 + 3, wallY2 - 1);
  return ridgeY;
}

// ---------------------------------------------------------------- 楼门
/** 楼门：双层门楼 */
export async function romon() {
  const u1 = -8, u2 = 8, v1 = -140, v2 = -134;
  const floorY = 64;
  await podium(u1 - 1, u2 + 1, v1 - 1, v2 + 1, floorY);
  await walls(u1, u2, v1, v2, 65, 68);
  // 中央门洞
  await fill(-3, v1, 65, 3, v1, 68, "minecraft:air");
  await fill(-3, v2, 65, 3, v2, 68, "minecraft:air");
  await fill(-3, v1, 69, 3, v2, 69, M.beam);
  // 门洞两侧的门扉（半开）
  await fill(-3, v1, 65, -3, v1, 67, M.beam);
  await fill(3, v1, 65, 3, v1, 67, M.beam);
  // 楼上栏杆
  await ring(u1 - 1, v1 - 1, u2 + 1, v2 + 1, 69, M.beam);
  for (let u = u1 - 1; u <= u2 + 1; u += 2) {
    await fill(u, v1 - 1, 69, u, v1 - 1, 70, M.post);
    await fill(u, v2 + 1, 69, u, v2 + 1, 70, M.post);
  }
  const ridgeY = await roofIrimoya(u1, u2, v1, v2, 71, { mat: M.roof, ridge: M.ridge });
  await shimenawa(-3, 3, v2 + 1, 68);
  return ridgeY;
}

// ---------------------------------------------------------------- 社务所
export async function shamusho() {
  const u1 = -40, u2 = -18, v1 = -152, v2 = -138;
  const floorY = 64;
  await podium(u1 - 1, u2 + 1, v1 - 1, v2 + 1, floorY);
  await walls(u1, u2, v1, v2, 65, 68, { wall: M.wall2 });
  await fill(u1 + 1, v1 + 1, floorY, u2 - 1, v2 - 1, floorY, M.floor);
  // 门窗
  await fill(-34, v2, 65, -30, v2, 67, M.lattice, { facing: "south", half: "top" });
  await fill(-27, v2, 65, -23, v2, 67, M.beam);
  await fill(-25, v2, 65, -25, v2, 66, "minecraft:air");
  const ridgeY = await roofKirizuma(u1, u2, v1, v2, 69, { mat: M.roof2, ridge: M.ridge });
  return ridgeY;
}

// ---------------------------------------------------------------- 神馔所 / 仓库
export async function jinzensho() {
  const u1 = 18, u2 = 36, v1 = -152, v2 = -142;
  const floorY = 64;
  await podium(u1 - 1, u2 + 1, v1 - 1, v2 + 1, floorY);
  await walls(u1, u2, v1, v2, 65, 67, { wall: M.wall2 });
  await fill(u1 + 1, v1 + 1, floorY, u2 - 1, v2 - 1, floorY, M.floor);
  await fill(24, v2, 65, 28, v2, 66, M.beam);
  const ridgeY = await roofKirizuma(u1, u2, v1, v2, 68, { mat: M.roof2, ridge: M.ridge });
  return ridgeY;
}

// ---------------------------------------------------------------- 钟楼
export async function shoro() {
  const u = 30, v = -128;
  const baseY = 64;
  await fill(u - 3, v - 3, baseY, u + 3, v + 3, baseY, M.stone);
  await fill(u - 3, v - 3, baseY - 1, u + 3, v + 3, baseY - 1, M.stone2);
  // 四柱
  for (const [du, dv] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
    await fill(u + du, v + dv, baseY + 1, u + du, v + dv, baseY + 5, M.post);
  }
  // 横梁
  await fill(u - 2, v - 2, baseY + 5, u + 2, v - 2, baseY + 5, M.beam);
  await fill(u - 2, v + 2, baseY + 5, u + 2, v + 2, baseY + 5, M.beam);
  await fill(u - 2, v - 2, baseY + 5, u - 2, v + 2, baseY + 5, M.beam);
  await fill(u + 2, v - 2, baseY + 5, u + 2, v + 2, baseY + 5, M.beam);
  // 吊钟
  await fill(u, v, baseY + 3, u, v, baseY + 4, M.gold);
  await set(u, v, baseY + 2, M.lampS);
  const ridgeY = await roofIrimoya(u - 3, u + 3, v - 3, v + 3, baseY + 6, { mat: M.roof, ridge: M.ridge });
  return ridgeY;
}
