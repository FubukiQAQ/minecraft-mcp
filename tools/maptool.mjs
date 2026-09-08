// 一次性工具：把 yarn mappings.tiny 索引化为 "类 -> 方法名/字段名" 查询表。
// 用途：跨 MC 版本移植本模组时，快速确认某个 API 在目标版本里到底叫什么。
//
// 下载映射（以 1.21.1 为例）：
//   curl -o mappings.tiny -L \
//     https://maven.fabricmc.net/net/fabricmc/yarn/1.21.1+build.3/yarn-1.21.1+build.3-v2.jar
//   unzip -o yarn-1.21.1+build.3-v2.jar -d y   # 得到 y/mappings/mappings.tiny
//
// 用法: node tools/maptool.mjs <mappings.tiny> <类名片段> [成员名片段]
//   例: node tools/maptool.mjs mappings.tiny net/minecraft/world/World raycast
//   注: 只想看全部成员时，过滤参数传 "m:"（全部方法）或 "f:"（全部字段）
import fs from "node:fs";

const file = process.argv[2];
const text = fs.readFileSync(file, "utf8");
const lines = text.split(/\r?\n/);

// 类：key = intermediary 全名, value = named 全名
const classes = new Map();
// 类 -> Set(named member)
const members = new Map();

let cur = null;
for (const line of lines) {
  if (!line) continue;
  const cols = line.split("\t");
  // tiny v2: 类行 "c\tinter\tnamed"；成员行以制表符开头 "\tm\tdesc\tinter\tnamed"
  const tag = cols[0] === "" ? cols[1] : cols[0];
  if (tag === "c" && cols[0] === "c") {
    const inter = cols[1];
    const named = cols.length >= 4 ? cols[3] : cols[2];
    classes.set(inter, named || inter);
    cur = inter;
    members.set(inter, new Set());
  } else if (tag === "m" && cur) {
    const named = cols[4] ?? cols[cols.length - 1];
    const desc = cols[2] ?? "";
    if (named && !named.startsWith("method_")) members.get(cur).add("m:" + named + "(" + desc + ")");
  } else if (tag === "f" && cur) {
    const named = cols[4] ?? cols[cols.length - 1];
    if (named && !named.startsWith("field_")) members.get(cur).add("f:" + named);
  }
}

const target = process.argv[3];
const filter = (process.argv[4] || "").toLowerCase();

const hits = [...classes.entries()].filter(([, n]) => n && n.includes(target));
if (hits.length === 0) {
  console.log(`未找到包含 "${target}" 的类`);
  process.exit(0);
}
for (const [inter, named] of hits) {
  const m = [...(members.get(inter) || [])]
    .filter((x) => x.toLowerCase().includes(filter))
    .sort();
  console.log(`\n### ${named}  (${inter})  成员数=${m.length}`);
  if (filter) console.log(m.join("  "));
}
