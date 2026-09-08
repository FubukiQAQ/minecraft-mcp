package net.mcpbridge.api.methods;

import com.google.gson.JsonObject;
import net.mcpbridge.api.Args;
import net.mcpbridge.api.MethodRegistry;
import net.mcpbridge.api.Permission;
import net.mcpbridge.api.RpcException;
import net.mcpbridge.api.Schema;
import net.mcpbridge.config.ModConfig;
import net.mcpbridge.core.GameContext;
import net.mcpbridge.util.GameFormat;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.entity.Entity;
import net.minecraft.item.ItemStack;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;

import java.util.UUID;

/**
 * 建造级方法：等价于"玩家亲手能做到的事"——放置方块、移动、说话、给物品、攻击。
 * 不会绕过权限系统（比如不能给自己 op）。
 */
public final class BuildMethods {

    private BuildMethods() {
    }

    public static void register() {
        MethodRegistry.register("set_block",
                "在指定坐标放置单个方块。block 用命名空间 ID，如 minecraft:stone；可用 properties 指定朝向等状态。",
                Permission.BUILD, Schema.of("放置方块",
                        Schema.props("x", "integer", "y", "integer", "z", "integer",
                                "block", "string", "properties", "object", "dim", "string"),
                        "x", "y", "z", "block"), args -> {
                    ServerWorld world = GameContext.world(args);
                    BlockPos pos = new BlockPos(args.i("x"), args.i("y"), args.i("z"));
                    BlockState state = GameFormat.parseBlockState(args.s("block"), args.obj("properties"));
                    boolean changed = world.setBlockState(pos, state, Block.NOTIFY_ALL);
                    JsonObject j = new JsonObject();
                    j.add("pos", GameFormat.pos(pos));
                    j.add("state", GameFormat.blockState(state));
                    j.addProperty("changed", changed);
                    return j;
                });

        MethodRegistry.register("fill_blocks",
                "批量填充一个长方体区域。体积受 maxFillVolume 限制（默认 32768）。",
                Permission.BUILD, Schema.of("区域填充",
                        Schema.props("x1", "integer", "y1", "integer", "z1", "integer",
                                "x2", "integer", "y2", "integer", "z2", "integer",
                                "block", "string", "properties", "object", "dim", "string"),
                        "x1", "y1", "z1", "x2", "y2", "z2", "block"), args -> {
                    ServerWorld world = GameContext.world(args);
                    int x1 = Math.min(args.i("x1"), args.i("x2"));
                    int y1 = Math.min(args.i("y1"), args.i("y2"));
                    int z1 = Math.min(args.i("z1"), args.i("z2"));
                    int x2 = Math.max(args.i("x1"), args.i("x2"));
                    int y2 = Math.max(args.i("y1"), args.i("y2"));
                    int z2 = Math.max(args.i("z1"), args.i("z2"));
                    long volume = (long) (x2 - x1 + 1) * (y2 - y1 + 1) * (z2 - z1 + 1);
                    if (volume > ModConfig.get().maxFillVolume) {
                        throw new RpcException(-32602, "填充体积 " + volume + " 超过上限 " + ModConfig.get().maxFillVolume);
                    }
                    BlockState state = GameFormat.parseBlockState(args.s("block"), args.obj("properties"));
                    BlockPos.Mutable m = new BlockPos.Mutable();
                    int changed = 0;
                    for (int y = y1; y <= y2; y++) {
                        for (int x = x1; x <= x2; x++) {
                            for (int z = z1; z <= z2; z++) {
                                if (world.setBlockState(m.set(x, y, z), state, Block.NOTIFY_ALL)) {
                                    changed++;
                                }
                            }
                        }
                    }
                    JsonObject j = new JsonObject();
                    j.addProperty("volume", volume);
                    j.addProperty("changed", changed);
                    j.add("state", GameFormat.blockState(state));
                    return j;
                });

        MethodRegistry.register("send_chat",
                "以玩家的身份在聊天栏说话（其他玩家可见），等价于玩家自己打字发言。",
                Permission.BUILD, Schema.of("发送聊天消息",
                        Schema.props("message", "string", "player", "string"), "message"), args -> {
                    ServerPlayerEntity p = GameContext.player(args);
                    String message = args.s("message").trim();
                    if (message.isEmpty()) {
                        throw new RpcException(-32602, "消息不能为空");
                    }
                    if (message.length() > 256) {
                        throw new RpcException(-32602, "消息过长（上限 256 字符）");
                    }
                    MinecraftServer server = GameContext.requireServer();
                    // 借用 say 命令，保留玩家署名，同时具备正确的广播语义
                    server.getCommandManager().executeWithPrefix(
                            p.getCommandSource().withLevel(4), "say " + message);
                    JsonObject j = new JsonObject();
                    j.addProperty("sent", true);
                    j.addProperty("as", p.getName().getString());
                    j.addProperty("message", message);
                    return j;
                });

        MethodRegistry.register("player_move",
                "把玩家传送到指定坐标，可同时设定朝向与维度。dim 省略时保持当前维度。",
                Permission.BUILD, Schema.of("移动玩家",
                        Schema.props("x", "number", "y", "number", "z", "number",
                                "yaw", "number", "pitch", "number", "player", "string", "dim", "string"),
                        "x", "y", "z"), args -> {
                    ServerPlayerEntity p = GameContext.player(args);
                    ServerWorld target = GameContext.world(args);
                    double x = args.d("x");
                    double y = args.d("y");
                    double z = args.d("z");
                    float yaw = (float) args.d("yaw", p.getYaw());
                    float pitch = (float) args.d("pitch", p.getPitch());
                    p.teleport(target, x, y, z, yaw, pitch);
                    JsonObject j = new JsonObject();
                    j.addProperty("player", p.getName().getString());
                    j.addProperty("dimension", GameContext.dimensionId(p.getServerWorld()));
                    j.add("pos", GameFormat.vec(p.getPos()));
                    return j;
                });

        MethodRegistry.register("player_look", "直接设置玩家的视角（yaw 水平角 / pitch 俯仰角）。",
                Permission.BUILD, Schema.of("设置视角",
                        Schema.props("yaw", "number", "pitch", "number", "player", "string"),
                        "yaw", "pitch"), args -> {
                    ServerPlayerEntity p = GameContext.player(args);
                    applyLook(p, (float) args.d("yaw"), (float) args.d("pitch"));
                    JsonObject j = new JsonObject();
                    j.addProperty("yaw", p.getYaw());
                    j.addProperty("pitch", p.getPitch());
                    return j;
                });

        MethodRegistry.register("look_at", "让玩家转身看向某个坐标点。",
                Permission.BUILD, Schema.of("看向坐标",
                        Schema.props("x", "number", "y", "number", "z", "number", "player", "string"),
                        "x", "y", "z"), args -> {
                    ServerPlayerEntity p = GameContext.player(args);
                    Vec3d eye = p.getEyePos();
                    Vec3d delta = new Vec3d(args.d("x"), args.d("y"), args.d("z")).subtract(eye);
                    double horizontal = Math.sqrt(delta.x * delta.x + delta.z * delta.z);
                    float yaw = (float) Math.toDegrees(Math.atan2(-delta.x, delta.z));
                    float pitch = (float) Math.toDegrees(-Math.atan2(delta.y, horizontal));
                    applyLook(p, yaw, pitch);
                    JsonObject j = new JsonObject();
                    j.addProperty("yaw", p.getYaw());
                    j.addProperty("pitch", p.getPitch());
                    return j;
                });

        MethodRegistry.register("give_item", "把物品放进玩家背包。",
                Permission.BUILD, Schema.of("给予物品",
                        Schema.props("item", "string", "count", "integer", "player", "string"), "item"), args -> {
                    ServerPlayerEntity p = GameContext.player(args);
                    int count = args.i("count", 1);
                    if (count < 1 || count > 640) {
                        throw new RpcException(-32602, "count 必须在 1..640 之间");
                    }
                    ItemStack stack = new ItemStack(GameFormat.resolveItem(args.s("item")), count);
                    boolean accepted = p.giveItemStack(stack);
                    JsonObject j = new JsonObject();
                    j.add("item", GameFormat.item(stack));
                    j.addProperty("accepted", accepted);
                    return j;
                });

        MethodRegistry.register("attack_entity", "让玩家攻击附近的实体（需在 5 格以内）。",
                Permission.BUILD, Schema.of("攻击实体",
                        Schema.props("uuid", "string", "player", "string"), "uuid"), args -> {
                    ServerPlayerEntity p = GameContext.player(args);
                    UUID uuid;
                    try {
                        uuid = UUID.fromString(args.s("uuid"));
                    } catch (IllegalArgumentException e) {
                        throw new RpcException(-32602, "uuid 不是合法的 UUID");
                    }
                    Entity target = p.getServerWorld().getEntity(uuid);
                    if (target == null) {
                        throw new RpcException(-32602, "当前维度找不到 UUID 为 " + uuid + " 的实体");
                    }
                    double distance = p.distanceTo(target);
                    if (distance > 5.0D) {
                        throw new RpcException(-32602, "目标距离 " + Math.round(distance * 10) / 10.0 + " 格，超出攻击距离");
                    }
                    p.attack(target);
                    JsonObject j = new JsonObject();
                    j.addProperty("attacked", true);
                    j.add("target", GameFormat.entity(target));
                    return j;
                });

        MethodRegistry.register("set_held_slot", "切换玩家当前手持的快捷栏槽位（0-8）。",
                Permission.BUILD, Schema.of("切换手持槽位",
                        Schema.props("slot", "integer", "player", "string"), "slot"), args -> {
                    ServerPlayerEntity p = GameContext.player(args);
                    int slot = args.i("slot");
                    if (slot < 0 || slot > 8) {
                        throw new RpcException(-32602, "slot 必须在 0..8 之间");
                    }
                    p.getInventory().selectedSlot = slot;
                    p.getInventory().markDirty();
                    JsonObject j = new JsonObject();
                    j.addProperty("selectedSlot", slot);
                    j.add("item", GameFormat.item(p.getInventory().getMainHandStack()));
                    return j;
                });
    }

    private static void applyLook(ServerPlayerEntity p, float yaw, float pitch) {
        // 复用 teleport 来同步朝向，避免手动 setYaw/setPitch 后客户端不同步
        p.teleport(p.getServerWorld(), p.getX(), p.getY(), p.getZ(), yaw, pitch);
    }
}
