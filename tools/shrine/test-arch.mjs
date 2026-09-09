import { torii, stoneLantern, guardian, M } from "./arch.mjs";
import { printStats, levelAt, wz } from "./lib.mjs";

// 试建：第 1 座鸟居（入口，v=0 -> z=104，台面 y=73）
const y0 = levelAt(0);
console.log(`入口鸟居 v=0 z=${wz(0)} 地面 y=${y0}`);
await torii(0, 0, y0, 8, { height: 17 });
console.log("鸟居完成");

const y1 = levelAt(-70);
await stoneLantern(-11, -70, y1);
await guardian(11, -70, y1, "west");
printStats("试建");
