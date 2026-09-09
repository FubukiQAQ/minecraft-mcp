#!/usr/bin/env node
// 主建造脚本：日式神社建筑群总装。
//
// 布局（v 为纵深，0 = 最南端入口大鸟居；负值往北/往内）：
//   v=0       一之鸟居（大）
//   v=-13..   二之鸟居 …… 八之鸟居，构成参道
//   v=-74     手水舍（西侧）
//   v=-140    楼门（内院入口）
//   v=-144    拝殿
//   v=-156    币殿
//   v=-164    本殿
//   两侧：社务所（西）、神馔所（东）、钟楼（东）
//
//   node tools/shrine/build.mjs [阶段...]   # 不传参则全建

import { printStats, levelAt, wz, fill } from "./lib.mjs";
import { M, stoneLantern, guardian, shimenawa } from "./arch.mjs";
import { honden, heiden, haiden, romon, shamusho, jinzensho, shoro } from "./buildings.mjs";
import { temizuya, office, sando, innerWall, sanshosho } from "./structures.mjs";

const stage = process.argv[2] ?? "all";
const run = (name) => stage === "all" || stage === name;

// ---------------------------------------------------------------- 参道鸟居
const TORII = [
  { v: 0, halfW: 9, height: 18 },
  { v: -13, halfW: 8, height: 17 },
  { v: -26, halfW: 7, height: 16 },
  { v: -39, halfW: 7, height: 16 },
  { v: -52, halfW: 6, height: 15 },
  { v: -65, halfW: 6, height: 15 },
  { v: -78, halfW: 5, height: 14 },
  { v: -91, halfW: 5, height: 14 },
];

// 参道两侧石灯笼（成对，自南向北）
const LANTERNS = [];
for (const v of [4, -8, -20, -32, -44, -56, -68, -80, -92]) {
  const u = v > -50 ? 13 : 12;
  LANTERNS.push([-u, v, false], [u, v, false]);
}
// 内院灯笼
for (const v of [-136, -146, -158, -170]) LANTERNS.push([-15, v, true], [15, v, true]);

console.log("=== 神社建筑群总装 ===");
console.log(`主轴线 x=${-180}，参道自 z=${wz(0)} 向内延伸至 z=${wz(-180)}`);

if (run("sando")) {
  console.log("\n[1] 参道：8 座鸟居 + 石灯笼列…");
  await sando(TORII, LANTERNS);
}

if (run("guardian")) {
  console.log("[2] 狛犬一对…");
  await guardian(-12, -6, levelAt(-6), "east");
  await guardian(12, -6, levelAt(-6), "west");
  await guardian(-12, -100, levelAt(-100), "east");
  await guardian(12, -100, levelAt(-100), "west");
}

if (run("temizuya")) {
  console.log("[3] 手水舍…");
  await temizuya(-38, -74);
}

if (run("side")) {
  console.log("[4] 社务所 / 参集所 / 神馔所 / 钟楼…");
  await office(-38, -22, -68, -58); // 社务所
  await sanshosho(-40, -24, -110, -100); // 参集所（休息所）
  await jinzensho(); // 神馔所
  await shoro(); // 钟楼
}

if (run("wall")) {
  console.log("[5] 内院玉垣…");
  await innerWall();
}

if (run("romon")) {
  console.log("[6] 楼门…");
  await romon();
}

if (run("haiden")) {
  console.log("[7] 拝殿…");
  await haiden();
}

if (run("heiden")) {
  console.log("[8] 币殿…");
  await heiden();
}

if (run("honden")) {
  console.log("[9] 本殿…");
  await honden();
}

printStats("总装");
