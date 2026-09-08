package net.mcpbridge;

import com.google.gson.JsonObject;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.mcpbridge.api.methods.AdminMethods;
import net.mcpbridge.api.methods.BuildMethods;
import net.mcpbridge.api.methods.ReadMethods;
import net.mcpbridge.config.ModConfig;
import net.mcpbridge.core.EventLog;
import net.mcpbridge.core.GameEvents;
import net.mcpbridge.core.ThreadBridge;
import net.mcpbridge.http.BridgeHttpServer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;

/** 入口：装配配置、注册方法、挂上生命周期钩子，然后拉起 HTTP 桥。 */
public final class McpBridgeMod implements ModInitializer {

    public static final String MOD_ID = "mcpbridge";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    private static BridgeHttpServer http;

    @Override
    public void onInitialize() {
        ModConfig cfg = ModConfig.load();
        EventLog.configure(cfg.eventLog, cfg.eventLogSize);

        ReadMethods.register();
        BuildMethods.register();
        AdminMethods.register();
        GameEvents.register();

        ServerLifecycleEvents.SERVER_STARTED.register(server -> {
            ThreadBridge.setServer(server);
            JsonObject data = new JsonObject();
            data.addProperty("dedicated", server.isDedicated());
            EventLog.record("server_started", data);
            LOGGER.info("[mcpbridge] 世界已就绪，桥接能力已激活。");
        });

        ServerLifecycleEvents.SERVER_STOPPING.register(server -> {
            EventLog.record("server_stopping", null);
            ThreadBridge.setServer(null);
        });

        if (!cfg.enabled) {
            LOGGER.warn("[mcpbridge] 配置中 enabled=false，未启动 HTTP 桥。");
            return;
        }

        try {
            http = new BridgeHttpServer(cfg);
            int port = http.start();
            LOGGER.info("[mcpbridge] HTTP 桥已启动：http://{}:{}/rpc", cfg.bindAddress, port);
            LOGGER.info("[mcpbridge] 当前授权等级：{}（read / build / admin 之一）", cfg.permissionLevel);
            LOGGER.info("[mcpbridge] 令牌：{}", cfg.token);
            LOGGER.info("[mcpbridge] 令牌文件：config/mcpbridge.token，请交给 MCP server 使用。");
            if (cfg.allowRemoteBinding) {
                LOGGER.warn("[mcpbridge] 警告：已开启非回环地址绑定，请确保令牌足够强且处于可信网络！");
            }
        } catch (IOException e) {
            LOGGER.error("[mcpbridge] HTTP 桥启动失败：{}", e.getMessage());
        }
    }

    public static void shutdown() {
        if (http != null) {
            http.stop();
            http = null;
        }
    }
}
