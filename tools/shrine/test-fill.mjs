import { fill, printStats } from "./lib.mjs";
console.log("测试 fill(-48,-96,50,48,-96,78,stone) 对应世界 z=-30");
await fill(-48, -96, 50, 48, -96, 78, "minecraft:stone");
printStats();
console.log("测试 fill(-48,-96,64,48,-96,100,air)");
await fill(-48, -96, 64, 48, -96, 100, "minecraft:air");
printStats();
