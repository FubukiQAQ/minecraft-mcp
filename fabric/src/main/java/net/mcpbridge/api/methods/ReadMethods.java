package net.mcpbridge.api.methods;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import net.mcpbridge.api.Args;
import net.mcpbridge.api.MethodRegistry;
import net.mcpbridge.api.Permission;
import net.mcpbridge.api.Schema;
import net.mcpbridge.config.ModConfig;
import net.mcpbridge.core.EventLog;
import net.mcpbridge.core.GameContext;
import net.mcpbridge.core.ThreadBridge;
import net.mcpbridge.util.GameFormat;
import net.minecraft.block.BlockState;
import net.minecraft.entity.Entity;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.entry.RegistryEntry;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.Identifier;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.hit.HitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
import net.minecraft.util.math.Direction;
import net.minecraft.world.RaycastContext;
import net.minecraft.world.biome.Biome;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** 只读方法：观察世界，不产生任何副作用。 */
public final class ReadMethods {

    private ReadMethods() {
    }

    public static void register() {
        MethodRegistry.register("ping", "心跳检测：确认桥在、世界在，并拿到当前 tick。",
                Permission.READ, Schema.of("心跳检测"), args -> {
                    MinecraftServer server = GameContext.requireServer();
                    JsonObject j = new JsonObject();
                    j.addProperty("pong", true);
                    j.addProperty("tick", server.getTicks());
                    j.addProperty("players", server.getPlayerManager().getPlayerList().size());
                    return j;
                });

        MethodRegistry.register("get_world_info", "获取服务器与所有维度的概览：tick、人数、难度、时间、天气、出生点。",
                Permission.READ, Schema.of("获取世界概览"), args -> {
                    MinecraftServer server = GameContext.requireServer();
                    JsonObject j = new JsonObject();
                    j.addProperty("tick", server.getTicks());
                    j.addProperty("players", server.getPlayerManager().getPlayerList().size());
                    j.addProperty("maxPlayers", server.getPlayerManager().getMaxPlayerCount());
                    j.addProperty("dedicated", server.isDedicated());
                    j.addProperty("difficulty", server.getSaveProperties().getDifficulty().getName());

                    JsonArray worlds = new JsonArray();
                    for (ServerWorld w : server.getWorlds()) {
                        JsonObject o = new JsonObject();
                        o.addProperty("id", GameContext.dimensionId(w));
                        o.addProperty("time", w.getTime());
                        o.addProperty("dayTime", w.getTimeOfDay());
                        o.addProperty("raining", w.isRaining());
                        o.addProperty("thundering", w.isThundering());
                        o.add("spawn", GameFormat.pos(w.getSpawnPos()));
                        worlds.add(o);
                    }
                    j.add("worlds", worlds);
                    return j;
                });

        MethodRegistry.register("list_players", "列出所有在线玩家及简要状态。",
                Permission.READ, Schema.of("列出在线玩家"), args -> {
                    MinecraftServer server = GameContext.requireServer();
                    JsonArray arr = new JsonArray();
                    for (ServerPlayerEntity p : server.getPlayerManager().getPlayerList()) {
                        arr.add(brief(p));
                    }
                    JsonObject j = new JsonObject();
                    j.add("players", arr);
                    return j;
                });

        MethodRegistry.register("get_player",
                "获取某个玩家的完整状态：坐标、朝向、生命、饥饿、经验、游戏模式、所在维度。",
                Permission.READ, Schema.of("获取玩家状态",
                        Schema.props("player", "string", "withInventory", "boolean"), "x"), args -> {
                    ServerPlayerEntity p = GameContext.player(args);
                    JsonObject j = full(p);
                    if (args.b("withInventory", false)) {
                        j.add("inventory", inventory(p));
                    }
                    return j;
                });

        MethodRegistry.register("get_block", "读取指定坐标的方块：ID、方块状态属性、光照、是否有方块实体。",
                Permission.READ, Schema.of("读取方块",
                        Schema.props("x", "integer", "y", "integer", "z", "integer", "dim", "string"),
                        "x", "y", "z"), args -> {
                    ServerWorld world = GameContext.world(args);
                    BlockPos pos = new BlockPos(args.i("x"), args.i("y"), args.i("z"));
                    BlockState state = world.getBlockState(pos);
                    JsonObject j = GameFormat.blockState(state);
                    j.add("pos", GameFormat.pos(pos));
                    j.addProperty("light", world.getLightLevel(pos));
                    j.addProperty("hasBlockEntity", world.getBlockEntity(pos) != null);
                    return j;
                });

        MethodRegistry.register("scan_blocks",
                "统计一个长方体区域内的方块分布，返回各类方块的数量与少量样本坐标。",
                Permission.READ, Schema.of("区域扫描",
                        Schema.props("x1", "integer", "y1", "integer", "z1", "integer",
                                "x2", "integer", "y2", "integer", "z2", "integer", "dim", "string"),
                        "x1", "y1", "z1", "x2", "y2", "z2"), args -> {
                    ServerWorld world = GameContext.world(args);
                    int x1 = Math.min(args.i("x1"), args.i("x2"));
                    int y1 = Math.min(args.i("y1"), args.i("y2"));
                    int z1 = Math.min(args.i("z1"), args.i("z2"));
                    int x2 = Math.max(args.i("x1"), args.i("x2"));
                    int y2 = Math.max(args.i("y1"), args.i("y2"));
                    int z2 = Math.max(args.i("z1"), args.i("z2"));

                    long volume = (long) (x2 - x1 + 1) * (y2 - y1 + 1) * (z2 - z1 + 1);
                    if (volume > ModConfig.get().maxScanVolume) {
                        throw new net.mcpbridge.api.RpcException(-32602,
                                "扫描体积 " + volume + " 超过上限 " + ModConfig.get().maxScanVolume + "，请缩小范围");
                    }

                    Map<String, Integer> counts = new HashMap<>();
                    JsonArray samples = new JsonArray();
                    BlockPos.Mutable m = new BlockPos.Mutable();
                    for (int y = y1; y <= y2; y++) {
                        for (int x = x1; x <= x2; x++) {
                            for (int z = z1; z <= z2; z++) {
                                BlockState state = world.getBlockState(m.set(x, y, z));
                                Identifier id = net.minecraft.registry.Registries.BLOCK.getId(state.getBlock());
                                String key = id == null ? "minecraft:air" : id.toString();
                                counts.merge(key, 1, Integer::sum);
                                if (!state.isAir() && samples.size() < 50) {
                                    JsonObject s = new JsonObject();
                                    s.addProperty("block", key);
                                    s.add("pos", GameFormat.pos(new BlockPos(x, y, z)));
                                    samples.add(s);
                                }
                            }
                        }
                    }
                    JsonObject j = new JsonObject();
                    j.addProperty("volume", volume);
                    JsonObject c = new JsonObject();
                    counts.entrySet().stream()
                            .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                            .forEach(e -> c.addProperty(e.getKey(), e.getValue()));
                    j.add("counts", c);
                    j.add("samples", samples);
                    return j;
                });

        MethodRegistry.register("find_block",
                "以某点为中心搜索最近的指定方块，返回按距离排序的坐标列表。",
                Permission.READ, Schema.of("查找方块",
                        Schema.props("block", "string", "x", "integer", "y", "integer", "z", "integer",
                                "radius", "integer", "dim", "string", "limit", "integer"),
                        "block"), args -> {
                    ServerWorld world = GameContext.world(args);
                    ServerPlayerEntity anchor = GameContext.optionalPlayer(args);
                    double cx = args.d("x", anchor == null ? 0 : anchor.getX());
                    double cy = args.d("y", anchor == null ? 64 : anchor.getY());
                    double cz = args.d("z", anchor == null ? 0 : anchor.getZ());
                    int radius = args.i("radius", 16);
                    int limit = args.i("limit", 20);
                    String wanted = args.s("block");

                    if ((long) (2 * radius + 1) * (2 * radius + 1) * (2 * radius + 1) > ModConfig.get().maxScanVolume) {
                        throw new net.mcpbridge.api.RpcException(-32602, "搜索半径过大");
                    }

                    BlockPos origin = new BlockPos((int) Math.floor(cx), (int) Math.floor(cy), (int) Math.floor(cz));
                    BlockPos.Mutable m = new BlockPos.Mutable();
                    List<JsonObject> hits = new ArrayList<>();
                    for (int dy = -radius; dy <= radius; dy++) {
                        for (int dx = -radius; dx <= radius; dx++) {
                            for (int dz = -radius; dz <= radius; dz++) {
                                int x = origin.getX() + dx;
                                int y = origin.getY() + dy;
                                int z = origin.getZ() + dz;
                                if (y < world.getBottomY() || y >= world.getTopY()) {
                                    continue;
                                }
                                BlockState state = world.getBlockState(m.set(x, y, z));
                                Identifier id = net.minecraft.registry.Registries.BLOCK.getId(state.getBlock());
                                if (id == null || !id.toString().equals(wanted)) {
                                    continue;
                                }
                                JsonObject o = new JsonObject();
                                o.addProperty("block", id.toString());
                                o.add("pos", GameFormat.pos(new BlockPos(x, y, z)));
                                o.addProperty("distance", round(Math.sqrt(dx * dx + dy * dy + dz * dz)));
                                hits.add(o);
                            }
                        }
                    }
                    hits.sort(Comparator.comparingDouble(o -> o.get("distance").getAsDouble()));
                    JsonArray arr = new JsonArray();
                    for (int i = 0; i < Math.min(limit, hits.size()); i++) {
                        arr.add(hits.get(i));
                    }
                    JsonObject j = new JsonObject();
                    j.addProperty("searched", hits.size());
                    j.add("results", arr);
                    return j;
                });

        MethodRegistry.register("get_entities",
                "列出指定点附近的实体：类型、坐标、血量、UUID。可用 type 过滤（如 minecraft:zombie）。",
                Permission.READ, Schema.of("查询实体",
                        Schema.props("x", "number", "y", "number", "z", "number",
                                "radius", "number", "type", "string", "dim", "string", "limit", "integer"),
                        "x"), args -> {
                    ServerWorld world = GameContext.world(args);
                    Vec3d center = new Vec3d(args.d("x"), args.d("y"), args.d("z"));
                    double radius = Math.min(args.d("radius", 32), 128);
                    int limit = Math.min(args.i("limit", 50), ModConfig.get().maxEntitiesReturned);
                    String type = args.s("type", null);

                    Box box = new Box(center.x - radius, center.y - radius, center.z - radius,
                            center.x + radius, center.y + radius, center.z + radius);
                    List<Entity> found = new ArrayList<>(world.getEntitiesByClass(Entity.class, box, Entity::isAlive));
                    if (type != null) {
                        found.removeIf(e -> {
                            Identifier id = net.minecraft.registry.Registries.ENTITY_TYPE.getId(e.getType());
                            return id == null || !id.toString().equals(type);
                        });
                    }
                    found.sort(Comparator.comparingDouble(e -> e.squaredDistanceTo(center)));

                    JsonArray arr = new JsonArray();
                    for (int i = 0; i < Math.min(limit, found.size()); i++) {
                        arr.add(GameFormat.entity(found.get(i)));
                    }
                    JsonObject j = new JsonObject();
                    j.addProperty("count", found.size());
                    j.add("entities", arr);
                    return j;
                });

        MethodRegistry.register("get_inventory", "读取玩家背包：主栏、装备栏、副手、当前选中槽位。",
                Permission.READ, Schema.of("读取背包", Schema.props("player", "string"), "x"), args -> {
                    JsonObject j = new JsonObject();
                    j.add("inventory", inventory(GameContext.player(args)));
                    return j;
                });

        MethodRegistry.register("raycast",
                "从玩家视线发出射线，返回第一个命中的方块与（大致的）实体——回答\"我正在看什么\"。",
                Permission.READ, Schema.of("视线射线检测",
                        Schema.props("distance", "number", "player", "string")), args -> {
                    ServerPlayerEntity p = GameContext.player(args);
                    double max = Math.min(args.d("distance", 32), ModConfig.get().maxRaycastDistance);
                    ServerWorld world = p.getServerWorld();

                    Vec3d eye = p.getEyePos();
                    Vec3d look = lookVector(p.getYaw(), p.getPitch());
                    BlockHitResult hit = world.raycast(new RaycastContext(eye, eye.add(look.multiply(max)),
                            RaycastContext.ShapeType.OUTLINE, RaycastContext.FluidHandling.NONE, p));

                    JsonObject j = new JsonObject();
                    j.add("eye", GameFormat.vec(eye));
                    j.add("direction", GameFormat.vec(look));

                    JsonObject block = new JsonObject();
                    block.addProperty("hit", hit.getType() != HitResult.Type.MISS);
                    if (hit.getType() != HitResult.Type.MISS) {
                        block.add("pos", GameFormat.pos(hit.getBlockPos()));
                        block.addProperty("side", hit.getSide().name());
                        block.add("state", GameFormat.blockState(world.getBlockState(hit.getBlockPos())));
                        block.addProperty("distance", round(eye.distanceTo(hit.getPos())));
                    }
                    j.add("block", block);

                    // 实体：用一个围绕射线的圆锥近似判定（角度阈值内的最近者）
                    double bestDistance = max;
                    Entity best = null;
                    Box box = new Box(eye.x - max, eye.y - max, eye.z - max, eye.x + max, eye.y + max, eye.z + max);
                    for (Entity e : world.getEntitiesByClass(Entity.class, box, x -> x.isAlive() && x != p)) {
                        Vec3d to = e.getEyePos().subtract(eye);
                        double dist = to.length();
                        if (dist > bestDistance) {
                            continue;
                        }
                        double cos = to.normalize().dotProduct(look);
                        if (cos > 0.985) {
                            bestDistance = dist;
                            best = e;
                        }
                    }
                    if (best == null) {
                        j.add("entity", new JsonObject());
                    } else {
                        JsonObject e = GameFormat.entity(best);
                        e.addProperty("distance", round(bestDistance));
                        j.add("entity", e);
                    }
                    return j;
                });

        MethodRegistry.register("get_biome", "查询指定坐标的生物群系。",
                Permission.READ, Schema.of("查询生物群系",
                        Schema.props("x", "integer", "y", "integer", "z", "integer", "dim", "string"),
                        "x", "y", "z"), args -> {
                    ServerWorld world = GameContext.world(args);
                    BlockPos pos = new BlockPos(args.i("x"), args.i("y"), args.i("z"));
                    RegistryEntry<Biome> entry = world.getBiome(pos);
                    Identifier id = entry.getKey().map(k -> k.getValue()).orElse(null);
                    JsonObject j = new JsonObject();
                    j.add("pos", GameFormat.pos(pos));
                    j.addProperty("biome", id == null ? "unknown" : id.toString());
                    return j;
                });

        MethodRegistry.register("get_events",
                "增量拉取最近的游戏事件（聊天、死亡、进出服）。传入上次拿到的最大 seq 即可只取新增部分。",
                Permission.READ, Schema.of("拉取事件",
                        Schema.props("since", "integer", "limit", "integer")), args -> {
                    int since = args.i("since", 0);
                    int limit = Math.min(args.i("limit", 50), 500);
                    JsonObject j = new JsonObject();
                    j.add("events", EventLog.since(since, limit));
                    j.addProperty("latestSeq", EventLog.latestSeq());
                    return j;
                });

        MethodRegistry.register("list_methods", "列出本桥暴露的全部方法及其权限等级与参数 schema。",
                Permission.READ, Schema.of("列出所有方法"), args -> {
                    JsonObject j = new JsonObject();
                    j.add("methods", MethodRegistry.toJson());
                    return j;
                });
    }

    private static JsonObject brief(ServerPlayerEntity p) {
        JsonObject j = new JsonObject();
        j.addProperty("name", p.getName().getString());
        j.addProperty("uuid", p.getUuid().toString());
        j.addProperty("dimension", GameContext.dimensionId(p.getServerWorld()));
        j.add("pos", GameFormat.vec(p.getPos()));
        j.addProperty("health", round(p.getHealth()));
        j.addProperty("gamemode", p.interactionManager.getGameMode().name());
        return j;
    }

    private static JsonObject full(ServerPlayerEntity p) {
        JsonObject j = new JsonObject();
        j.addProperty("name", p.getName().getString());
        j.addProperty("uuid", p.getUuid().toString());
        j.addProperty("dimension", GameContext.dimensionId(p.getServerWorld()));
        j.add("pos", GameFormat.vec(p.getPos()));
        j.add("blockPos", GameFormat.pos(p.getBlockPos()));
        j.addProperty("yaw", round(p.getYaw()));
        j.addProperty("pitch", round(p.getPitch()));
        j.addProperty("health", round(p.getHealth()));
        j.addProperty("maxHealth", round(p.getMaxHealth()));
        j.addProperty("food", p.getHungerManager().getFoodLevel());
        j.addProperty("saturation", round(p.getHungerManager().getSaturationLevel()));
        j.addProperty("xpLevel", p.experienceLevel);
        j.addProperty("gamemode", p.interactionManager.getGameMode().name());
        j.addProperty("onGround", p.isOnGround());
        j.addProperty("sneaking", p.isSneaking());
        j.addProperty("sprinting", p.isSprinting());
        j.add("mainHand", GameFormat.item(p.getMainHandStack()));
        return j;
    }

    private static JsonObject inventory(ServerPlayerEntity p) {
        JsonArray main = new JsonArray();
        for (int i = 0; i < p.getInventory().main.size(); i++) {
            ItemStack stack = p.getInventory().main.get(i);
            if (stack.isEmpty()) {
                continue;
            }
            JsonObject o = GameFormat.item(stack);
            o.addProperty("slot", i);
            main.add(o);
        }
        JsonArray armor = new JsonArray();
        for (ItemStack stack : p.getInventory().armor) {
            if (!stack.isEmpty()) {
                armor.add(GameFormat.item(stack));
            }
        }
        JsonObject off = GameFormat.item(p.getInventory().offHand.get(0));
        JsonObject j = new JsonObject();
        j.add("main", main);
        j.add("armor", armor);
        j.add("offHand", off);
        j.addProperty("selectedSlot", p.getInventory().selectedSlot);
        return j;
    }

    /** 由 yaw/pitch 计算单位朝向向量（与游戏内部公式一致）。 */
    static Vec3d lookVector(float yaw, float pitch) {
        double y = Math.toRadians(yaw);
        double p = Math.toRadians(pitch);
        return new Vec3d(-Math.sin(y) * Math.cos(p), -Math.sin(p), Math.cos(y) * Math.cos(p));
    }

    private static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
