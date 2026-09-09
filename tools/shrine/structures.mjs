#!/usr/bin/env node
// 附属设施：手水舍、社务所、参集所、鸟居参道、石灯笼列、狛犬、玉垣。

import { fill, set, ring, levelAt } from "./lib.mjs";
import { M, roofKirizuma, roofIrimoya, torii, stoneLantern, guardian, shimenawa, tamagaki, stairOf } from "./arch.mjs";

// ---------------------------------------------------------------- 手水舍
/** 手水舍：四柱小亭，中间石水盘，龙口吐水 */
export async function temizuya(u, v) {
  const y = levelAt(v);
  const u1 = u - 5, u2 = u + 5, v1 = v - 4, v2 = v + 4;
  // 基座
  await fill(u1, v1, y, u2, v2, y, M.stone2);
  // 四柱
  for (const [uu, vv] of [[u1 + 1, v1 + 1], [u2 - 1, v1 + 1], [u1 + 1, v2 - 1], [u2 - 1, v2 - 1]]) {
    await fill(uu, vv, y + 1, uu, vv, y + 4, M.post);
  }
  // 横梁
  await ring(u1 + 1, v1 + 1, u2 - 1, v2 - 1, y + 4, M.beam);
  // 石水盘
  await fill(u - 2, v - 1, y + 1, u + 2, v + 1, y + 1, M.stone);
  await fill(u - 2, v - 1, y + 2, u + 2, v + 1, y + 2, M.stone);
  await fill(u - 1, v - 1, y + 2, u + 1, v + 1, y + 2, M.water);
  // 柄杓（用木棍表示）
  for (const uu of [u - 2, u + 2]) await set(uu, v + 1, y + 3, M.beam);
  // 屋顶
  await roofKirizuma(u1, u2, v1, v2, y + 5, { mat: M.roof2, ridge: M.ridge });
  // 前注连绳
  await shimenawa(u - 3, u + 3, v2 + 1, y + 3);
  return y + 5;
}

// ---------------------------------------------------------------- 社务所（独立小屋）
/** 社务所：参道旁的事务所建筑 */
export async function office(u1, u2, v1, v2) {
  const y = levelAt(v1);
  await fill(u1 - 1, v1 - 1, y, u2 + 1, v2 + 1, y, M.stone);
  await fill(u1 - 1, v1 - 1, y - 1, u2 + 1, v2 + 1, y - 1, M.stone2);
  // 墙
  for (let yy = y + 1; yy <= y + 4; yy++) await ring(u1, v1, u2, v2, yy, M.wall2);
  for (const [uu, vv] of [[u1, v1], [u1, v2], [u2, v1], [u2, v2]]) {
    await fill(uu, vv, y + 1, uu, vv, y + 4, M.post);
  }
  for (let uu = u1 + 4; uu <= u2 - 4; uu += 4) await fill(uu, v2, y + 1, uu, v2, y + 4, M.post);
  // 门窗
  await fill(u1 + 2, v2, y + 1, u1 + 5, v2, y + 3, M.lattice, { facing: "south", half: "top" });
  await fill(u2 - 5, v2, y + 1, u2 - 2, v2, y + 3, M.lattice, { facing: "south", half: "top" });
  const mid = Math.floor((u1 + u2) / 2);
  await fill(mid - 1, v2, y + 1, mid + 1, v2, y + 3, M.beam);
  await fill(mid, v2, y + 1, mid, v2, y + 2, "minecraft:air");
  await fill(u1 + 1, v1 + 1, y + 1, u2 - 1, v2 - 1, y + 1, M.floor);
  await roofKirizuma(u1, u2, v1, v2, y + 5, { mat: M.roof2, ridge: M.ridge });
  return y + 5;
}

// ---------------------------------------------------------------- 参道
/**
 * 参道：一排鸟居 + 两侧石灯笼。
 * specs: [{v, halfW, height}] 由南（入口）到北（内院）排列。
 */
export async function sando(specs, lanternSpots) {
  const tops = [];
  for (const s of specs) {
    const y = levelAt(s.v);
    const top = await torii(0, s.v, y, s.halfW, { height: s.height });
    tops.push({ v: s.v, top });
  }
  for (const [u, v, small] of lanternSpots) {
    await stoneLantern(u, v, levelAt(v), { small });
  }
  return tops;
}

// ---------------------------------------------------------------- 玉垣（内院围墙）
export async function innerWall() {
  const u1 = -22, u2 = 22, v1 = -182, v2 = -132;
  const y = 63;
  // 四边
  for (let u = u1; u <= u2; u++) {
    await fill(u, v1, y + 1, u, v1, y + 3, M.stone2);
    await fill(u, v2, y + 1, u, v2, y + 3, M.stone2);
    if ((u - u1) % 4 === 0) {
      await fill(u, v1, y + 1, u, v1, y + 4, M.stone);
      await fill(u, v2, y + 1, u, v2, y + 4, M.stone);
    }
  }
  for (let v = v1; v <= v2; v++) {
    await fill(u1, v, y + 1, u1, v, y + 3, M.stone2);
    await fill(u2, v, y + 1, u2, v, y + 3, M.stone2);
    if ((v - v1) % 4 === 0) {
      await fill(u1, v, y + 1, u1, v, y + 4, M.stone);
      await fill(u2, v, y + 1, u2, v, y + 4, M.stone);
    }
  }
  // 南面留出楼门门洞
  await fill(-9, v2, y + 1, 9, v2, y + 4, "minecraft:air");
  return y;
}

// ---------------------------------------------------------------- 参集所（休息所）
export async function sanshosho(u1, u2, v1, v2) {
  const y = levelAt(v1);
  await fill(u1 - 1, v1 - 1, y, u2 + 1, v2 + 1, y, M.stone2);
  for (let yy = y + 1; yy <= y + 3; yy++) await ring(u1, v1, u2, v2, yy, M.wall2);
  for (const [uu, vv] of [[u1, v1], [u1, v2], [u2, v1], [u2, v2]]) {
    await fill(uu, vv, y + 1, uu, vv, y + 3, M.post);
  }
  // 敞开式（柱子间不填墙）
  for (let uu = u1 + 1; uu <= u2 - 1; uu++) await fill(uu, v2, y + 1, uu, v2, y + 3, "minecraft:air");
  for (let vv = v1 + 1; vv <= v2 - 1; vv++) {
    await fill(u1, vv, y + 1, u1, vv, y + 3, "minecraft:air");
    await fill(u2, vv, y + 1, u2, vv, y + 3, "minecraft:air");
  }
  for (let uu = u1 + 2; uu <= u2 - 2; uu += 3) {
    await fill(uu, v2, y + 1, uu, v2, y + 3, M.post);
    await fill(uu, v1, y + 1, uu, v1, y + 3, M.post);
  }
  await fill(u1 + 1, v1 + 1, y + 1, u2 - 1, v2 - 1, y + 1, M.floor);
  await roofKirizuma(u1, u2, v1, v2, y + 4, { mat: M.roof2, ridge: M.ridge });
  return y + 4;
}
