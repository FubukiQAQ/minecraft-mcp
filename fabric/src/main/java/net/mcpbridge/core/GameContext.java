package net.mcpbridge.core;

import net.mcpbridge.api.Args;
import net.mcpbridge.api.RpcException;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.PlayerManager;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.Identifier;
import net.minecraft.world.World;

import java.util.List;

/**
 * 从请求参数解析出"世界"和"玩家"。
 *
 * 注意：这里的每一个方法都必须在**主线程**上调用。
 */
public final class GameContext {

    private GameContext() {
    }

    public static MinecraftServer requireServer() throws RpcException {
        MinecraftServer server = ThreadBridge.server();
        if (server == null) {
            throw new RpcException(RpcException.NOT_READY,
                    "当前没有正在运行的 Minecraft 服务端（单人世界或专用服务端均可）。");
        }
        return server;
    }

    /**
     * 解析目标维度：显式传 dim 时用之，否则回落到"默认玩家所在的维度"，
     * 再不行就是主世界。
     */
    public static ServerWorld world(Args args) throws RpcException {
        MinecraftServer server = requireServer();
        String dim = args.s("dim", null);
        if (dim == null) {
            ServerPlayerEntity p = optionalPlayer(server, args);
            return p != null ? p.getServerWorld() : server.getOverworld();
        }
        Identifier id = Identifier.tryParse(dim);
        if (id == null) {
            throw new RpcException(-32602, "非法的维度 ID: " + dim);
        }
        ServerWorld world = server.getWorld(RegistryKey.of(RegistryKeys.WORLD, id));
        if (world == null) {
            throw new RpcException(-32602, "未知或不存在的维度: " + dim);
        }
        return world;
    }

    /** 解析目标玩家：显式传 player（名字或 UUID）时用之，否则取唯一在线玩家。 */
    public static ServerPlayerEntity player(Args args) throws RpcException {
        MinecraftServer server = requireServer();
        ServerPlayerEntity p = optionalPlayer(server, args);
        if (p == null) {
            throw new RpcException(RpcException.NOT_READY, "当前没有在线玩家可供操作。");
        }
        return p;
    }

    /**
     * 可选地解析玩家：找不到时返回 null，而不是抛异常。
     * 适用于"有玩家就用玩家当锚点，没有也能靠显式坐标工作"的方法。
     */
    public static ServerPlayerEntity optionalPlayer(Args args) throws RpcException {
        return optionalPlayer(ThreadBridge.server(), args);
    }

    private static ServerPlayerEntity optionalPlayer(MinecraftServer server, Args args) throws RpcException {
        String name = args.s("player", null);
        PlayerManager manager = server.getPlayerManager();
        if (name != null) {
            ServerPlayerEntity byName = manager.getPlayer(name);
            if (byName != null) {
                return byName;
            }
            try {
                ServerPlayerEntity byUuid = manager.getPlayer(java.util.UUID.fromString(name));
                if (byUuid != null) {
                    return byUuid;
                }
            } catch (IllegalArgumentException ignored) {
                // 不是 UUID，按用户名处理即可
            }
            throw new RpcException(-32602, "找不到在线玩家: " + name);
        }
        List<ServerPlayerEntity> players = manager.getPlayerList();
        if (players.isEmpty()) {
            return null;
        }
        return players.get(0);
    }

    /** 世界维度的稳定字符串表示，如 minecraft:overworld。 */
    public static String dimensionId(World world) {
        RegistryKey<World> key = world.getRegistryKey();
        return key == null ? "unknown" : key.getValue().toString();
    }
}
