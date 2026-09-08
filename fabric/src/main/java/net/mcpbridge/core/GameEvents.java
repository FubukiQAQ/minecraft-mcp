package net.mcpbridge.core;

import com.google.gson.JsonObject;
import net.fabricmc.fabric.api.entity.event.v1.ServerLivingEntityEvents;
import net.fabricmc.fabric.api.message.v1.ServerMessageEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.mcpbridge.config.ModConfig;
import net.minecraft.entity.LivingEntity;
import net.minecraft.server.network.ServerPlayerEntity;

/** 把游戏里发生的瞬时事件收进 {@link EventLog}，供外部 AI 增量拉取。 */
public final class GameEvents {

    private GameEvents() {
    }

    public static void register() {
        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
            ServerPlayerEntity player = handler.player;
            if (player == null) {
                return;
            }
            JsonObject data = new JsonObject();
            data.addProperty("player", player.getName().getString());
            data.addProperty("uuid", player.getUuid().toString());
            EventLog.record("player_join", data);
        });

        ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
            ServerPlayerEntity player = handler.player;
            if (player == null) {
                return;
            }
            JsonObject data = new JsonObject();
            data.addProperty("player", player.getName().getString());
            data.addProperty("uuid", player.getUuid().toString());
            EventLog.record("player_leave", data);
        });

        ServerLivingEntityEvents.AFTER_DEATH.register((entity, source) -> {
            boolean isPlayer = entity instanceof ServerPlayerEntity;
            if (!isPlayer && !ModConfig.get().logMobDeaths) {
                return;
            }
            JsonObject data = new JsonObject();
            data.addProperty("entity", entity.getName().getString());
            data.addProperty("isPlayer", isPlayer);
            data.addProperty("x", entity.getX());
            data.addProperty("y", entity.getY());
            data.addProperty("z", entity.getZ());
            data.addProperty("cause", source == null ? "unknown" : source.getName());
            EventLog.record("entity_death", data);
        });

        ServerMessageEvents.CHAT_MESSAGE.register((message, sender, params) -> {
            JsonObject data = new JsonObject();
            data.addProperty("player", sender == null ? "unknown" : sender.getName().getString());
            data.addProperty("message", message.getContent().getString());
            EventLog.record("chat", data);
        });
    }
}
