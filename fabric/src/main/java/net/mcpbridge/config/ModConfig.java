package net.mcpbridge.config;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;
import net.mcpbridge.api.Permission;
import net.mcpbridge.core.EventLog;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;

/**
 * 模组配置，落地在 {@code config/mcpbridge.json}。
 *
 * 令牌在首次启动时自动生成。出于便利我们额外写一份 {@code config/mcpbridge.token}，
 * 供外部 MCP server 读取（也可以直接把它填进环境变量 MCPBRIDGE_TOKEN）。
 */
public final class ModConfig {

    private static final Logger LOGGER = LoggerFactory.getLogger("mcpbridge");
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final SecureRandom RANDOM = new SecureRandom();

    private static volatile ModConfig INSTANCE = new ModConfig();

    // ---- 网络 ----
    public boolean enabled = true;
    public String bindAddress = "127.0.0.1";
    /** 想让局域网/其它机器访问时才打开，并且必须同时配好令牌。 */
    public boolean allowRemoteBinding = false;
    /** 0 表示由系统分配空闲端口，实际端口会打印到日志。 */
    public int port = 8765;
    public String token = "";

    // ---- 安全 ----
    /** read | build | admin —— AI 能触达的最高权限。 */
    public String permissionLevel = "build";
    public int requestTimeoutMs = 5000;
    /** off | denylist | allowlist */
    public String commandMode = "denylist";
    public List<String> commandDenylist = new ArrayList<>(List.of(
            "stop", "op", "deop", "whitelist", "ban", "ban-ip", "banlist",
            "pardon", "pardon-ip", "kick", "save-all", "save-off", "save-on",
            "datapack", "jfr", "debug", "publish", "setidletimeout", "forceload"));
    public List<String> commandAllowlist = new ArrayList<>();

    // ---- 性能护栏 ----
    public int maxScanVolume = 250_000;
    public int maxFillVolume = 32_768;
    public int maxRaycastDistance = 128;
    public int maxEntitiesReturned = 200;

    // ---- 事件 ----
    public boolean eventLog = true;
    public int eventLogSize = 500;
    public boolean logMobDeaths = false;

    private transient Path file;

    public static ModConfig get() {
        return INSTANCE;
    }

    public static ModConfig load() {
        Path file = FabricLoader.getInstance().getConfigDir().resolve("mcpbridge.json");
        ModConfig cfg = new ModConfig();
        if (Files.exists(file)) {
            try {
                ModConfig parsed = GSON.fromJson(Files.readString(file, StandardCharsets.UTF_8), ModConfig.class);
                if (parsed != null) {
                    cfg = parsed;
                }
            } catch (Exception e) {
                LOGGER.error("[mcpbridge] 配置文件读取失败，将使用默认配置: {}", e.getMessage());
            }
        }
        if (cfg.token == null || cfg.token.isBlank()) {
            cfg.token = generateToken();
        }
        cfg.file = file;
        cfg.normalize();
        cfg.save();
        INSTANCE = cfg;
        cfg.writeTokenFile();
        return cfg;
    }

    public void save() {
        try {
            Files.createDirectories(file.getParent());
            Files.writeString(file, GSON.toJson(this), StandardCharsets.UTF_8);
        } catch (IOException e) {
            LOGGER.error("[mcpbridge] 配置文件写入失败: {}", e.getMessage());
        }
    }

    public Permission permission() {
        return Permission.parse(permissionLevel);
    }

    // ------------------------------------------------------------------ 运行时改配置

    /** 深拷贝一份草稿，供配置界面编辑；点"取消"时直接丢弃，不影响运行中的实例。 */
    public ModConfig copy() {
        ModConfig draft = GSON.fromJson(GSON.toJson(this), ModConfig.class);
        if (draft == null) {
            draft = new ModConfig();
        }
        draft.file = this.file;
        return draft;
    }

    /**
     * 把 other 的字段就地写入 this。
     *
     * 必须就地写：{@link net.mcpbridge.http.BridgeHttpServer} 持有本对象的引用，
     * 直接替换单例会让桥继续读旧配置。用反射遍历字段是为了以后新增配置项不用改这里。
     */
    public void copyFrom(ModConfig other) {
        for (Field field : ModConfig.class.getDeclaredFields()) {
            int mods = field.getModifiers();
            if (Modifier.isStatic(mods) || Modifier.isTransient(mods) || field.isSynthetic()) {
                continue;
            }
            try {
                field.setAccessible(true);
                field.set(this, field.get(other));
            } catch (ReflectiveOperationException | RuntimeException e) {
                LOGGER.warn("[mcpbridge] 配置字段 {} 写入失败：{}", field.getName(), e.getMessage());
            }
        }
        normalize();
    }

    /** 把界面里填的值收进合法区间，避免手改文件或乱填把桥搞崩。 */
    public void normalize() {
        token = token == null ? "" : token.trim();
        permissionLevel = switch (Permission.parse(permissionLevel)) {
            case READ -> "read";
            case BUILD -> "build";
            case ADMIN -> "admin";
        };
        String mode = commandMode == null ? "denylist" : commandMode.trim().toLowerCase();
        commandMode = switch (mode) {
            case "off" -> "off";
            case "allowlist" -> "allowlist";
            default -> "denylist";
        };
        if (commandDenylist == null) {
            commandDenylist = new ArrayList<>();
        }
        if (commandAllowlist == null) {
            commandAllowlist = new ArrayList<>();
        }
        bindAddress = bindAddress == null || bindAddress.isBlank() ? "127.0.0.1" : bindAddress.trim();
        port = clamp(port, 0, 65535);
        requestTimeoutMs = clamp(requestTimeoutMs, 100, 120_000);
        maxScanVolume = clamp(maxScanVolume, 1_000, 5_000_000);
        maxFillVolume = clamp(maxFillVolume, 1, 1_000_000);
        maxRaycastDistance = clamp(maxRaycastDistance, 1, 512);
        maxEntitiesReturned = clamp(maxEntitiesReturned, 1, 2_000);
        eventLogSize = clamp(eventLogSize, 16, 10_000);
    }

    /**
     * 让非网络类配置立刻生效。
     *
     * 权限、命令策略、护栏、事件缓冲都是每次请求 / 每次事件现场读的，改了就生效；
     * 只有 EventLog 的容量需要重新下发一次。端口、绑定地址、enabled 这类要重启 HTTP 桥，
     * 见 {@link net.mcpbridge.McpBridgeMod#applyNetworkConfig()}。
     */
    public void applyRuntime() {
        normalize();
        EventLog.configure(eventLog, eventLogSize);
        save();
        writeTokenFile();
    }

    /** 生成一枚新令牌，不改动当前实例（配置界面「生成」按钮用）。 */
    public static String newToken() {
        return generateToken();
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private void writeTokenFile() {
        try {
            Path tokenFile = FabricLoader.getInstance().getConfigDir().resolve("mcpbridge.token");
            Files.createDirectories(tokenFile.getParent());
            Files.writeString(tokenFile, token, StandardCharsets.UTF_8);
        } catch (IOException e) {
            LOGGER.warn("[mcpbridge] 令牌文件写入失败: {}", e.getMessage());
        }
    }

    private static String generateToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        StringBuilder sb = new StringBuilder(64);
        for (byte b : bytes) {
            sb.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
        }
        return sb.toString();
    }
}
