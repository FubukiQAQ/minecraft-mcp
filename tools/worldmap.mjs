// 直接读取 Minecraft 区域文件（.mca），把世界渲染成文字/ASCII 图，用于无视觉模型时的自检。
//
//   node tools/worldmap.mjs height  <cx1> <cz1> <cx2> <cz2>            # 高度图（ASCII）
//   node tools/worldmap.mjs top     <x1> <z1> <x2> <z2> [step]         # 顶面材质图
//   node tools/worldmap.mjs column  <x> <z>                            # 逐层列出方块
//   node tools/worldmap.mjs counts  <x1> <z1> <x2> <z2>                # 方块统计
//   node tools/worldmap.mjs slice   <y> <x1> <z1> <x2> <z2>            # 某一层的平面图
//
// 环境变量 WORLD_DIR 指向存档目录（含 region/ 的 world 目录）。

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

const WORLD_DIR =
  process.env.WORLD_DIR ?? "D:\\PCL2CE\\.minecraft\\versions\\1.21.1-Fabric 0.19.5\\saves\\新的世界";
const REGION_DIR = join(WORLD_DIR, "region");

// ---------------------------------------------------------------- NBT 解析
class Reader {
  constructor(buf, pos = 0) {
    this.buf = buf;
    this.pos = pos;
  }
  u8() {
    return this.buf[this.pos++];
  }
  i16() {
    const v = this.buf.readInt16BE(this.pos);
    this.pos += 2;
    return v;
  }
  u16() {
    const v = this.buf.readUInt16BE(this.pos);
    this.pos += 2;
    return v;
  }
  i32() {
    const v = this.buf.readInt32BE(this.pos);
    this.pos += 4;
    return v;
  }
  i64() {
    const v = this.buf.readBigInt64BE(this.pos);
    this.pos += 8;
    return v;
  }
  f32() {
    const v = this.buf.readFloatBE(this.pos);
    this.pos += 4;
    return v;
  }
  f64() {
    const v = this.buf.readDoubleBE(this.pos);
    this.pos += 8;
    return v;
  }
  str() {
    const len = this.u16();
    const s = this.buf.toString("utf8", this.pos, this.pos + len);
    this.pos += len;
    return s;
  }
  bytes(n) {
    const b = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return b;
  }
}

function readPayload(r, type) {
  switch (type) {
    case 0:
      return null;
    case 1:
      return r.u8();
    case 2:
      return r.i16();
    case 3:
      return r.i32();
    case 4:
      return r.i64();
    case 5:
      return r.f32();
    case 6:
      return r.f64();
    case 7: {
      const n = r.i32();
      return r.bytes(n);
    }
    case 8:
      return r.str();
    case 9: {
      const itemType = r.u8();
      const n = r.i32();
      const arr = [];
      for (let i = 0; i < n; i++) arr.push(readPayload(r, itemType));
      return arr;
    }
    case 10: {
      const obj = {};
      for (;;) {
        const t = r.u8();
        if (t === 0) break;
        const name = r.str();
        obj[name] = readPayload(r, t);
      }
      return obj;
    }
    case 11: {
      const n = r.i32();
      const arr = [];
      for (let i = 0; i < n; i++) arr.push(r.i32());
      return arr;
    }
    case 12: {
      const n = r.i32();
      const arr = [];
      for (let i = 0; i < n; i++) arr.push(r.i64());
      return arr;
    }
    default:
      throw new Error("未知 NBT 类型 " + type);
  }
}

function parseNbt(buf) {
  const r = new Reader(buf);
  const type = r.u8();
  if (type !== 10) throw new Error("根标签不是 compound");
  r.str();
  return readPayload(r, 10);
}

// ---------------------------------------------------------------- 区域文件
const regionCache = new Map();

function chunkKey(cx, cz) {
  return cx + "," + cz;
}

function loadChunk(cx, cz) {
  const k = chunkKey(cx, cz);
  if (regionCache.has(k)) return regionCache.get(k);
  const rx = cx >> 5;
  const rz = cz >> 5;
  const file = join(REGION_DIR, `r.${rx}.${rz}.mca`);
  let chunk = null;
  if (existsSync(file)) {
    const buf = readFileSync(file);
    const idx = ((cx & 31) + (cz & 31) * 32) * 4;
    const offset = buf.readUIntBE(idx, 3) * 4096;
    const len = buf.readUInt32BE(idx + 3);
    if (offset > 0 && len > 0 && offset + 4 <= buf.length) {
      const n = buf.readUInt32BE(offset);
      const comp = buf[offset + 4];
      const data = buf.subarray(offset + 5, offset + 4 + n);
      let raw;
      if (comp === 1) raw = inflateSync(data);
      else if (comp === 2) raw = inflateSync(data);
      else raw = data;
      chunk = parseNbt(raw);
    }
  }
  regionCache.set(k, chunk);
  return chunk;
}

/** 返回某个 (x,y,z) 的方块名；y 超出范围返回 air */
function getBlock(x, y, z) {
  const cx = x >> 4;
  const cz = z >> 4;
  const chunk = loadChunk(cx, cz);
  if (!chunk) return null; // 未加载
  const section = (chunk.sections ?? []).find((s) => s.Y === y >> 4);
  if (!section) return "minecraft:air";
  const bsp = section.block_states;
  if (!bsp) return "minecraft:air";
  const palette = bsp.palette ?? [];
  const data = bsp.data;
  if (!data || palette.length === 0) {
    return palette[0]?.Name ?? "minecraft:air";
  }
  const bits = Math.max(4, 32 - Math.clz32(palette.length - 1));
  const perLong = Math.floor(64 / bits);
  const lx = x & 15;
  const lz = z & 15;
  const ly = y & 15;
  const index = ly * 256 + lz * 16 + lx;
  const li = Math.floor(index / perLong);
  const off = (index % perLong) * bits;
  const long = BigInt.asUintN(64, data[li]);
  const id = Number((long >> BigInt(off)) & ((1n << BigInt(bits)) - 1n));
  return palette[id]?.Name ?? "minecraft:air";
}

// ---------------------------------------------------------------- 渲染
const SHORT = (name) =>
  (name ?? "?").replace("minecraft:", "").replace(/_block$/, "").replace(/_concrete$/, "");

const HEIGHT_MIN = -64;
const HEIGHT_MAX = 96;

function topY(x, z) {
  for (let y = HEIGHT_MAX; y >= HEIGHT_MIN; y--) {
    const b = getBlock(x, y, z);
    if (b && b !== "minecraft:air" && b !== "minecraft:cave_air" && b !== "minecraft:water") return { y, b };
  }
  return { y: null, b: null };
}

const HCHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function cmdHeight(x1, z1, x2, z2, step) {
  let minY = 999, maxY = -999;
  const grid = [];
  for (let z = z1; z <= z2; z += step) {
    let row = "";
    for (let x = x1; x <= x2; x += step) {
      const { y } = topY(x, z);
      if (y === null) {
        row += " ";
        continue;
      }
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      row += y < 0 ? " " : HCHARS[Math.min(HCHARS.length - 1, y)];
    }
    grid.push(row);
  }
  console.log(`高度图 x[${x1}..${x2}] z[${z1}..${z2}] 步长${step}  min=${minY} max=${maxY}`);
  console.log(`图例: ' '=空 0-9a-z=高度 0..35（>=36 用大写）`);
  for (const row of grid) console.log(row);
}

function cmdTop(x1, z1, x2, z2, step) {
  console.log(`顶面材质图 x[${x1}..${x2}] z[${z1}..${z2}] 步长${step}`);
  const legend = new Map();
  let next = 0;
  const chars = ".#*+=@%$&!?ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let z = z1; z <= z2; z += step) {
    let row = "";
    for (let x = x1; x <= x2; x += step) {
      const { y, b } = topY(x, z);
      const s = SHORT(b);
      if (!legend.has(s)) legend.set(s, chars[next++] ?? "?");
      row += legend.get(s);
    }
    console.log(row);
  }
  console.log("图例: " + [...legend].map(([k, v]) => `${v}=${k}`).join(" "));
}

function cmdColumn(x, z) {
  console.log(`柱状剖面 x=${x} z=${z}`);
  for (let y = 40; y >= -4; y--) {
    const b = getBlock(x, y, z);
    if (b && b !== "minecraft:air") console.log(`  y=${String(y).padStart(4)}  ${b}`);
  }
}

function cmdCounts(x1, z1, x2, z2) {
  const counts = new Map();
  for (let x = x1; x <= x2; x++) {
    for (let z = z1; z <= z2; z++) {
      const { y, b } = topY(x, z);
      const s = SHORT(b);
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
  }
  const sorted = [...counts].sort((a, b) => b[1] - a[1]);
  console.log(`顶面方块统计 x[${x1}..${x2}] z[${z1}..${z2}]`);
  for (const [k, v] of sorted) console.log(`  ${String(v).padStart(7)}  ${k}`);
}

function cmdSlice(y, x1, z1, x2, z2) {
  console.log(`y=${y} 平面图 x[${x1}..${x2}] z[${z1}..${z2}]`);
  const legend = new Map();
  let next = 0;
  const chars = ".#*+=@%$&!?ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let z = z1; z <= z2; z++) {
    let row = "";
    for (let x = x1; x <= x2; x++) {
      const b = getBlock(x, y, z);
      const s = b === "minecraft:air" ? " " : SHORT(b);
      if (!legend.has(s)) legend.set(s, s === " " ? " " : chars[next++] ?? "?");
      row += legend.get(s);
    }
    console.log(row);
  }
  console.log("图例: " + [...legend].filter(([k]) => k !== " ").map(([k, v]) => `${v}=${k}`).join(" "));
}

// ---------------------------------------------------------------- 入口
const [cmd, ...a] = process.argv.slice(2);
const n = a.map(Number);
switch (cmd) {
  case "height":
    cmdHeight(n[0], n[1], n[2], n[3], n[4] || 2);
    break;
  case "top":
    cmdTop(n[0], n[1], n[2], n[3], n[4] || 1);
    break;
  case "column":
    cmdColumn(n[0], n[1]);
    break;
  case "counts":
    cmdCounts(n[0], n[1], n[2], n[3]);
    break;
  case "slice":
    cmdSlice(n[0], n[1], n[2], n[3], n[4]);
    break;
  default:
    console.error("用法见文件头注释");
    process.exit(1);
}
