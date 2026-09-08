package net.mcpbridge.api;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import net.mcpbridge.core.ThreadBridge;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeoutException;

/** 方法注册表 + 分发器：鉴权、超时、错误码都收敛在这里。 */
public final class MethodRegistry {

    private static final Map<String, MethodEntry> MAP = new LinkedHashMap<>();

    private MethodRegistry() {
    }

    public static void register(MethodEntry entry) {
        MAP.put(entry.name, entry);
    }

    public static void register(String name, String description, Permission required, JsonObject schema, MethodHandler handler) {
        register(new MethodEntry(name, description, required, schema, handler));
    }

    public static MethodEntry get(String name) {
        return name == null ? null : MAP.get(name);
    }

    public static Collection<MethodEntry> all() {
        return MAP.values();
    }

    /**
     * 分发一次调用：先查方法，再做权限分级校验，最后把执行体丢到游戏主线程。
     *
     * @param granted  配置授权的等级上限
     * @param timeoutMs 主线程执行超时（毫秒）
     */
    public static JsonObject dispatch(String name, Args args, Permission granted, long timeoutMs) throws Exception {
        MethodEntry entry = get(name);
        if (entry == null) {
            throw new RpcException(-32601, "未注册的方法: " + name);
        }
        if (entry.required.level > granted.level) {
            throw new RpcException(RpcException.FORBIDDEN,
                    "方法 " + name + " 需要 " + entry.required.name().toLowerCase()
                            + " 权限，当前只授予了 " + granted.name().toLowerCase());
        }
        try {
            return ThreadBridge.call(() -> entry.handler.handle(args), timeoutMs);
        } catch (TimeoutException e) {
            throw new RpcException(RpcException.TIMEOUT, "主线程执行超时（" + timeoutMs + "ms），可能是世界卡顿或操作范围过大", e);
        } catch (ExecutionException e) {
            Throwable cause = e.getCause() == null ? e : e.getCause();
            if (cause instanceof RpcException rpc) {
                throw rpc;
            }
            throw new RpcException(-32603, cause.getClass().getSimpleName() + ": " + cause.getMessage(), cause);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RpcException(-32603, "请求被中断", e);
        }
    }

    public static JsonArray toJson() {
        JsonArray arr = new JsonArray();
        for (MethodEntry e : MAP.values()) {
            arr.add(e.toJson());
        }
        return arr;
    }
}
