package net.mcpbridge.api.methods;

import com.google.gson.JsonObject;
import net.mcpbridge.api.MethodRegistry;
import net.mcpbridge.api.Permission;
import net.mcpbridge.api.RpcException;
import net.mcpbridge.api.Schema;
import net.mcpbridge.config.ModConfig;
import net.mcpbridge.core.GameContext;
import net.minecraft.server.MinecraftServer;

/**
 * 管理级方法：以服务器控制台（权限等级 4）的身份执行命令、改时间与天气。
 *
 * 这一层默认通过 commandMode=denylist 兜底，危险命令（stop / op / ban ...）一律拦掉。
 */
public final class AdminMethods {

    private AdminMethods() {
    }

    public static void register() {
        MethodRegistry.register("run_command",
                "以服务器控制台身份执行一条指令。受配置中的 commandMode（黑名单/白名单）约束。",
                Permission.ADMIN, Schema.of("执行命令",
                        Schema.props("command", "string"), "command"), args -> {
                    MinecraftServer server = GameContext.requireServer();
                    String command = normalize(args.s("command"));
                    if (command.isEmpty()) {
                        throw new RpcException(-32602, "命令不能为空");
                    }
                    String root = command.split(" ")[0].toLowerCase();
                    ModConfig cfg = ModConfig.get();
                    switch (cfg.commandMode == null ? "denylist" : cfg.commandMode.toLowerCase()) {
                        case "off" -> throw new RpcException(RpcException.FORBIDDEN,
                                "当前配置禁用了任意命令执行（commandMode=off）");
                        case "allowlist" -> {
                            if (!cfg.commandAllowlist.contains(root)) {
                                throw new RpcException(RpcException.FORBIDDEN,
                                        "命令 " + root + " 不在白名单内");
                            }
                        }
                        default -> {
                            if (cfg.commandDenylist.contains(root)) {
                                throw new RpcException(RpcException.FORBIDDEN,
                                        "命令 " + root + " 被安全策略拦截");
                            }
                        }
                    }
                    run(server, command);
                    JsonObject j = new JsonObject();
                    j.addProperty("executed", true);
                    j.addProperty("command", command);
                    return j;
                });

        MethodRegistry.register("set_time",
                "设置世界时间。可传数字，或 day / night / noon / midnight。",
                Permission.ADMIN, Schema.of("设置时间",
                        Schema.props("time", "string"), "time"), args -> {
                    MinecraftServer server = GameContext.requireServer();
                    String time = args.s("time").trim().toLowerCase();
                    String value = switch (time) {
                        case "day", "night", "noon", "midnight" -> time;
                        default -> {
                            try {
                                yield String.valueOf(Long.parseLong(time));
                            } catch (NumberFormatException e) {
                                throw new RpcException(-32602, "time 必须是数字或 day/night/noon/midnight");
                            }
                        }
                    };
                    run(server, "time set " + value);
                    JsonObject j = new JsonObject();
                    j.addProperty("set", value);
                    j.addProperty("dayTime", server.getOverworld().getTimeOfDay());
                    return j;
                });

        MethodRegistry.register("set_weather",
                "设置天气：clear / rain / thunder，duration 单位为秒（默认 6000）。",
                Permission.ADMIN, Schema.of("设置天气",
                        Schema.props("type", "string", "duration", "integer"), "type"), args -> {
                    MinecraftServer server = GameContext.requireServer();
                    String type = args.s("type").trim().toLowerCase();
                    if (!type.equals("clear") && !type.equals("rain") && !type.equals("thunder")) {
                        throw new RpcException(-32602, "type 必须是 clear / rain / thunder");
                    }
                    int duration = args.i("duration", 6000);
                    run(server, "weather " + type + " " + Math.max(1, duration));
                    JsonObject j = new JsonObject();
                    j.addProperty("weather", type);
                    j.addProperty("duration", duration);
                    return j;
                });
    }

    /** 用控制台权限执行命令；先做一次解析校验，能提前把语法错误反馈给调用方。 */
    private static void run(MinecraftServer server, String command) throws RpcException {
        var dispatcher = server.getCommandManager().getDispatcher();
        var parsed = dispatcher.parse(command, server.getCommandSource());
        if (!parsed.getExceptions().isEmpty()) {
            StringBuilder sb = new StringBuilder();
            for (var ex : parsed.getExceptions().values()) {
                sb.append(ex.getMessage()).append("; ");
            }
            throw new RpcException(-32602, "命令解析失败: " + sb);
        }
        server.getCommandManager().executeWithPrefix(server.getCommandSource(), command);
    }

    private static String normalize(String command) {
        String c = command == null ? "" : command.trim();
        if (c.startsWith("/")) {
            c = c.substring(1);
        }
        return c.trim();
    }
}
