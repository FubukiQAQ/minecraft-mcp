import { z } from "zod";

export interface ToolDef {
  /** 与模组侧方法名一一对应。 */
  name: string;
  title: string;
  description: string;
  input: z.ZodRawShape;
  /** 仅用于文档/提示，真正的权限判定在模组侧完成。 */
  permission: "read" | "build" | "admin";
}

const int = (description: string) => z.number().int().describe(description);
const num = (description: string) => z.number().describe(description);
const str = (description: string) => z.string().describe(description);
const bool = (description: string) => z.boolean().describe(description);

export const TOOLS: ToolDef[] = [
  // ---------------------------------------------------------------- 只读
  {
    name: "ping",
    title: "心跳检测",
    description: "确认桥是否在线、世界是否已加载，并拿到当前 tick 与在线人数。",
    input: {},
    permission: "read",
  },
  {
    name: "get_world_info",
    title: "世界概览",
    description:
      "获取服务器与全部维度的概览：tick、性能、在线人数、难度，以及每个维度的时间、天气、出生点。",
    input: {},
    permission: "read",
  },
  {
    name: "list_players",
    title: "在线玩家列表",
    description: "列出所有在线玩家的名字、UUID、所在维度、坐标与血量。",
    input: {},
    permission: "read",
  },
  {
    name: "get_player",
    title: "玩家状态",
    description:
      "获取某个玩家的完整状态：坐标、朝向、生命、饥饿、饱食度、经验等级、游戏模式、所在维度。不传 player 时取第一个在线玩家。",
    input: {
      player: str("玩家名或 UUID，省略则取第一个在线玩家").optional(),
      withInventory: bool("是否一并返回背包内容").optional(),
    },
    permission: "read",
  },
  {
    name: "get_block",
    title: "读取方块",
    description: "读取指定坐标的方块 ID、方块状态属性、光照等级，以及是否存在方块实体。",
    input: {
      x: int("X 坐标"),
      y: int("Y 坐标"),
      z: int("Z 坐标"),
      dim: str("维度 ID，如 minecraft:the_nether；省略则用玩家所在维度").optional(),
    },
    permission: "read",
  },
  {
    name: "scan_blocks",
    title: "区域方块统计",
    description:
      "统计一个长方体区域内的方块分布，返回各类方块的数量与最多 50 个非空样本坐标。体积上限由模组配置 maxScanVolume 决定。",
    input: {
      x1: int("起点 X"),
      y1: int("起点 Y"),
      z1: int("起点 Z"),
      x2: int("终点 X"),
      y2: int("终点 Y"),
      z2: int("终点 Z"),
      dim: str("维度 ID").optional(),
    },
    permission: "read",
  },
  {
    name: "find_block",
    title: "查找方块",
    description:
      "以某点为中心搜索最近的指定方块，返回按距离升序排列的坐标列表。不传坐标时以玩家位置为中心。",
    input: {
      block: str("方块命名空间 ID，如 minecraft:diamond_ore"),
      x: int("中心 X，省略则用玩家位置").optional(),
      y: int("中心 Y，省略则用玩家位置").optional(),
      z: int("中心 Z，省略则用玩家位置").optional(),
      radius: int("搜索半径，默认 16").optional(),
      limit: int("最多返回多少条，默认 20").optional(),
      dim: str("维度 ID").optional(),
    },
    permission: "read",
  },
  {
    name: "get_entities",
    title: "查询实体",
    description:
      "列出指定点附近的所有存活实体：类型、坐标、血量、UUID。可用 type 精确过滤（如 minecraft:zombie）。",
    input: {
      x: num("中心 X"),
      y: num("中心 Y"),
      z: num("中心 Z"),
      radius: num("半径，默认 32，最大 128").optional(),
      type: str("实体类型 ID 过滤").optional(),
      limit: int("最多返回多少条，默认 50").optional(),
      dim: str("维度 ID").optional(),
    },
    permission: "read",
  },
  {
    name: "get_inventory",
    title: "读取背包",
    description: "读取玩家背包的主栏（带槽位）、装备栏、副手以及当前选中的快捷栏槽位。",
    input: { player: str("玩家名或 UUID").optional() },
    permission: "read",
  },
  {
    name: "raycast",
    title: "视线射线检测",
    description:
      "从玩家眼睛沿视线发出射线，返回第一个命中的方块（含坐标、朝向面、距离）以及视线前方的实体——用来回答「我现在正看着什么」。",
    input: {
      distance: num("射线长度，默认 32，受模组 maxRaycastDistance 限制").optional(),
      player: str("玩家名或 UUID").optional(),
    },
    permission: "read",
  },
  {
    name: "get_biome",
    title: "查询生物群系",
    description: "查询指定坐标所属的生物群系 ID。",
    input: {
      x: int("X 坐标"),
      y: int("Y 坐标"),
      z: int("Z 坐标"),
      dim: str("维度 ID").optional(),
    },
    permission: "read",
  },
  {
    name: "get_events",
    title: "拉取游戏事件",
    description:
      "增量拉取最近的事件（聊天、死亡、进出服、服务端启停）。传入上次拿到的最大 seq 即可只取新增部分。",
    input: {
      since: int("只返回 seq 大于该值的事件，默认 0").optional(),
      limit: int("最多返回多少条，默认 50").optional(),
    },
    permission: "read",
  },
  {
    name: "list_methods",
    title: "列出所有方法",
    description: "列出桥暴露的全部方法、所需权限等级与参数 schema。",
    input: {},
    permission: "read",
  },

  // ---------------------------------------------------------------- 建造
  {
    name: "set_block",
    title: "放置方块",
    description:
      "在指定坐标放置单个方块。block 用命名空间 ID；可用 properties 指定朝向等方块状态，如 {\"facing\": \"north\"}。",
    input: {
      x: int("X 坐标"),
      y: int("Y 坐标"),
      z: int("Z 坐标"),
      block: str("方块 ID，如 minecraft:oak_stairs"),
      properties: z.record(z.string()).describe("方块状态属性键值对").optional(),
      dim: str("维度 ID").optional(),
    },
    permission: "build",
  },
  {
    name: "fill_blocks",
    title: "区域填充",
    description: "把一整个长方体区域填充为指定方块。体积上限由模组配置 maxFillVolume 决定（默认 32768）。",
    input: {
      x1: int("起点 X"),
      y1: int("起点 Y"),
      z1: int("起点 Z"),
      x2: int("终点 X"),
      y2: int("终点 Y"),
      z2: int("终点 Z"),
      block: str("方块 ID"),
      properties: z.record(z.string()).describe("方块状态属性键值对").optional(),
      dim: str("维度 ID").optional(),
    },
    permission: "build",
  },
  {
    name: "send_chat",
    title: "发送聊天",
    description: "以玩家身份在聊天栏发言，其他玩家可见——等价于玩家自己打字。最长 256 字符。",
    input: {
      message: str("要发送的内容"),
      player: str("以哪个玩家的身份发送").optional(),
    },
    permission: "build",
  },
  {
    name: "player_move",
    title: "移动玩家",
    description: "把玩家传送到指定坐标，可同时设置朝向与目标维度。不传 dim 则留在当前维度。",
    input: {
      x: num("目标 X"),
      y: num("目标 Y"),
      z: num("目标 Z"),
      yaw: num("水平朝向角，省略则保持不变").optional(),
      pitch: num("俯仰角，省略则保持不变").optional(),
      player: str("玩家名或 UUID").optional(),
      dim: str("目标维度 ID").optional(),
    },
    permission: "build",
  },
  {
    name: "player_look",
    title: "设置视角",
    description: "直接设置玩家的 yaw（水平角）与 pitch（俯仰角）。",
    input: {
      yaw: num("水平朝向角"),
      pitch: num("俯仰角"),
      player: str("玩家名或 UUID").optional(),
    },
    permission: "build",
  },
  {
    name: "look_at",
    title: "看向坐标",
    description: "让玩家转身看向某个坐标点，自动计算 yaw/pitch。",
    input: {
      x: num("目标 X"),
      y: num("目标 Y"),
      z: num("目标 Z"),
      player: str("玩家名或 UUID").optional(),
    },
    permission: "build",
  },
  {
    name: "give_item",
    title: "给予物品",
    description: "把物品放进玩家背包。count 范围 1..640。",
    input: {
      item: str("物品 ID，如 minecraft:diamond_sword"),
      count: int("数量，默认 1").optional(),
      player: str("玩家名或 UUID").optional(),
    },
    permission: "build",
  },
  {
    name: "attack_entity",
    title: "攻击实体",
    description: "让玩家攻击指定 UUID 的实体，目标需在同一维度且距离 5 格以内。",
    input: {
      uuid: str("目标实体 UUID，可从 get_entities 获得"),
      player: str("玩家名或 UUID").optional(),
    },
    permission: "build",
  },
  {
    name: "set_held_slot",
    title: "切换手持槽位",
    description: "切换玩家当前手持的快捷栏槽位（0-8）。",
    input: {
      slot: int("槽位，0..8"),
      player: str("玩家名或 UUID").optional(),
    },
    permission: "build",
  },

  // ---------------------------------------------------------------- 管理
  {
    name: "run_command",
    title: "执行命令",
    description:
      "以服务器控制台（权限等级 4）身份执行一条 Minecraft 指令。受模组配置的黑名单/白名单约束，默认拦掉 stop / op / ban 等危险指令。",
    input: { command: str("要执行的指令，可带或不带前导斜杠") },
    permission: "admin",
  },
  {
    name: "set_time",
    title: "设置时间",
    description: "设置世界时间，可传数字（tick）或 day / night / noon / midnight。",
    input: { time: str("时间值或 day/night/noon/midnight") },
    permission: "admin",
  },
  {
    name: "set_weather",
    title: "设置天气",
    description: "设置天气：clear / rain / thunder，duration 单位为秒（默认 6000）。",
    input: {
      type: str("clear | rain | thunder"),
      duration: int("持续秒数，默认 6000").optional(),
    },
    permission: "admin",
  },
];
