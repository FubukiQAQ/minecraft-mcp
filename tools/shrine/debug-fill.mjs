import { rpc } from "../mc.mjs";
import { fill, printStats } from "./lib.mjs";

const X = -180;
const Z = -30;
const probe = async (label) => {
  const parts = [];
  for (let y = 60; y <= 76; y++) {
    const b = await rpc("get_block", { x: X, y, z: Z });
    if (!b.isAir) parts.push(`${y}:${b.block.replace("minecraft:", "")}`);
  }
  console.log(`${label}: ${parts.join(" ")}`);
};

await probe("初始");
await fill(-48, -96, 64, 48, -96, 78, "minecraft:air");
printStats();
await probe("清空后");
