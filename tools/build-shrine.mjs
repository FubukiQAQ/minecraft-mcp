#!/usr/bin/env node
// 在玩家正前方建造一座日式神社场景。
//
// 设计要点：场景用「局部坐标」描述（u=横向，v=纵深，h=离地高度），
// 再按玩家朝向旋转到世界坐标 —— 这样玩家朝东南西北都能正确摆放，
// 连需要朝向的方块（狛犬、赛钱箱）的 facing 也会跟着旋转。
//
// 用法: MCPBRIDGE_TOKEN=xxx node tools/build-shrine.mjs

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

function call(method, params) {
  const out = execFileSync(
    process.execPath,
    [join(HERE, "call.mjs"), method, JSON.stringify(params)],
    { encoding: "utf8", env: process.env },
  );
  return JSON.parse(out);
}

// ---------------------------------------------------------------- 朝向变换
const DIRS = {
  south: { U: [1, 0], V: [0, 1], f: { south: "south", east: "east", north: "north", west: "west" } },
  north: { U: [-1, 0], V: [0, -1], f: { south: "north", east: "west", north: "south", west: "east" } },
  east: { U: [0, -1], V: [1, 0], f: { south: "east", east: "north", north: "west", west: "south" } },
  west: { U: [0, 1], V: [-1, 0], f: { south: "west", east: "south", north: "east", west: "north" } },
};

const player = call("get_player", {});
const yaw = ((player.yaw % 360) + 360) % 360;
const dirName =
  yaw >= 45 && yaw < 135 ? "east" : yaw >= 135 && yaw < 225 ? "north" : yaw >= 225 && yaw < 315 ? "west" : "south";
const D = DIRS[dirName];

// 地面顶层：玩家脚下方块的下一格
const GY = player.blockPos.y - 1;
const OX = Math.floor(player.pos.x);
const OZ = Math.floor(player.pos.z) + Math.round(2.5 * D.V[1]) + Math.round(2.5 * D.V[0]);

const toWorld = (u, v) => ({
  x: OX + u * D.U[0] + v * D.V[0],
  z: OZ + u * D.U[1] + v * D.V[1],
});
const face = (local) => D.f[local] ?? local;

const ops = [];
const F = (u1, v1, h1, u2, v2, h2, block, props) =>
  ops.push({ kind: "fill", u1, v1, h1, u2, v2, h2, block, props });
const S = (u, v, h, block, props) => ops.push({ kind: "set", u, v, h, block, props });

// ---------------------------------------------------------------- 场景设计
// 开工前先清空整个场景体积 —— 让脚本幂等，反复运行不会留下残骸。
F(-8, 0, 1, 8, 17, 10, "minecraft:air");

// 参道与庭院
F(-8, 0, 0, 8, 17, 0, "minecraft:sand");                    // 白砂庭院
F(-1, 0, 0, 1, 16, 0, "minecraft:stone_bricks");            // 参道
F(-2, 0, 0, -2, 16, 0, "minecraft:polished_andesite");      // 路缘（左）
F(2, 0, 0, 2, 16, 0, "minecraft:polished_andesite");        // 路缘（右）

// 鸟居（明神鸟居：柱 / 贯 / 额束 / 岛木 / 笠木）
for (const u of [-2, 2]) F(u, 2, 1, u, 2, 5, "minecraft:red_concrete");
F(-2, 2, 4, 2, 2, 4, "minecraft:red_concrete");             // 贯
S(0, 2, 5, "minecraft:red_concrete");                       // 额束
F(-3, 2, 6, 3, 2, 6, "minecraft:red_concrete");             // 岛木
F(-3, 2, 7, 3, 2, 7, "minecraft:red_concrete");             // 笠木

// 入口小石灯 ×2（参道起点两侧，起引导作用）
for (const u of [-3, 3]) {
  S(u, 1, 1, "minecraft:stone_bricks");
  S(u, 1, 2, "minecraft:lantern");
  S(u, 1, 3, "minecraft:stone_brick_slab");
}

// 石灯笼 ×2（放在 v=6，与手水舍屋顶 v=1..5 错开，避免被覆盖）
for (const u of [-4, 4]) {
  S(u, 6, 1, "minecraft:stone_bricks");                     // 基座
  S(u, 6, 2, "minecraft:stone_brick_wall");                 // 竿
  S(u, 6, 3, "minecraft:lantern");                          // 火袋
  S(u, 6, 4, "minecraft:stone_brick_stairs");               // 笠
}

// 手水舍（洗手亭）：中心 u=-5, v=3，屋顶 u=-7..-3 / v=1..5
F(-6, 2, 0, -4, 4, 0, "minecraft:stone_bricks");            // 台座
F(-6, 2, 1, -4, 4, 1, "minecraft:stone_bricks");            // 水盘边
S(-5, 3, 1, "minecraft:water");                             // 水
for (const [u, v] of [[-6, 2], [-4, 2], [-6, 4], [-4, 4]]) F(u, v, 2, u, v, 3, "minecraft:spruce_log");
F(-7, 1, 4, -3, 5, 4, "minecraft:dark_oak_slab");           // 屋顶

// 狛犬 ×2（头朝参道中心）
for (const u of [-2, 2]) {
  S(u, 7, 1, "minecraft:stone_bricks");                     // 台座
  S(u, 7, 2, "minecraft:stone_bricks");                     // 身
  S(u, 7, 3, "minecraft:stone_brick_stairs", { facing: face(u < 0 ? "east" : "west") });
}

// 本殿
F(-3, 9, 1, 3, 15, 1, "minecraft:stone_bricks");            // 台基
F(-1, 8, 1, 1, 8, 1, "minecraft:stone_brick_slab");         // 一级台阶
F(-2, 10, 2, 2, 14, 2, "minecraft:dark_oak_planks");        // 殿内木地板
F(-2, 10, 3, 2, 10, 5, "minecraft:spruce_planks");          // 前墙
F(-2, 14, 3, 2, 14, 5, "minecraft:spruce_planks");          // 后墙
F(-2, 11, 3, -2, 13, 5, "minecraft:spruce_planks");         // 左墙
F(2, 11, 3, 2, 13, 5, "minecraft:spruce_planks");           // 右墙
F(0, 10, 3, 0, 10, 4, "minecraft:air");                     // 门
F(-1, 10, 5, 1, 10, 5, "minecraft:chain");                  // 注连绳
S(0, 9, 2, "minecraft:chest", { facing: face("north") });   // 赛钱箱

// 屋顶（阶梯出檐 + 屋脊）
F(-4, 8, 6, 4, 16, 6, "minecraft:dark_oak_slab");
F(-3, 9, 7, 3, 15, 7, "minecraft:dark_oak_planks");
F(-2, 10, 8, 2, 14, 8, "minecraft:dark_oak_planks");
F(-1, 11, 9, 1, 13, 9, "minecraft:dark_oak_log");           // 屋脊 / 鲣木

// 樱花树 ×4
for (const [u, v] of [[-6, 6], [6, 6], [-6, 12], [6, 12]]) {
  F(u, v, 1, u, v, 5, "minecraft:cherry_log");
  F(u - 2, v - 2, 5, u + 2, v + 2, 6, "minecraft:cherry_leaves");
  F(u - 1, v - 1, 7, u + 1, v + 1, 7, "minecraft:cherry_leaves");
}

// ---------------------------------------------------------------- 执行
console.log(`玩家 ${player.name} 朝向 ${dirName}（yaw=${player.yaw}），地面顶层 y=${GY}`);
console.log(`场景原点 (${OX}, ${OZ})，共 ${ops.length} 次调用\n`);

let ok = 0;
let failed = 0;
for (const op of ops) {
  const a = toWorld(op.u1 ?? op.u, op.v1 ?? op.v);
  const b = toWorld(op.u2 ?? op.u, op.v2 ?? op.v);
  const x1 = Math.min(a.x, b.x);
  const x2 = Math.max(a.x, b.x);
  const z1 = Math.min(a.z, b.z);
  const z2 = Math.max(a.z, b.z);
  const y1 = GY + (op.h1 ?? op.h);
  const y2 = GY + (op.h2 ?? op.h);

  const params = { block: op.block };
  if (op.props) {
    params.properties = Object.fromEntries(
      Object.entries(op.props).map(([k, val]) => [k, val]),
    );
  }

  try {
    const res =
      op.kind === "fill"
        ? call("fill_blocks", { x1, y1, z1, x2, y2, z2, ...params })
        : call("set_block", { x: x1, y: y1, z: z1, ...params });
    const changed = res.changed ?? 1;
    if (op.kind === "fill" && changed === 0) {
      console.log(`  ! 无变化 ${op.block} @${x1},${y1},${z1}`);
      failed++;
    } else {
      ok++;
    }
  } catch (e) {
    console.log(`  ✗ ${op.block} @${x1},${y1},${z1}: ${String(e.message).slice(0, 90)}`);
    failed++;
  }
}
console.log(`\n完成：成功 ${ok}，异常 ${failed}`);
