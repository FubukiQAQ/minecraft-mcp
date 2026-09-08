package net.mcpbridge.api;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/** 对请求参数的轻量包装，取值时统一抛出 {@link RpcException}。 */
public final class Args {

    private final JsonObject o;

    public Args(JsonObject o) {
        this.o = o == null ? new JsonObject() : o;
    }

    public JsonObject raw() {
        return o;
    }

    public boolean has(String key) {
        return o.has(key) && !o.get(key).isJsonNull();
    }

    public int i(String key) throws RpcException {
        return (int) number(key);
    }

    public int i(String key, int fallback) throws RpcException {
        return has(key) ? i(key) : fallback;
    }

    public double d(String key) throws RpcException {
        return number(key);
    }

    public double d(String key, double fallback) throws RpcException {
        return has(key) ? d(key) : fallback;
    }

    public String s(String key) throws RpcException {
        require(key);
        JsonElement e = o.get(key);
        if (!e.isJsonPrimitive() || !e.getAsJsonPrimitive().isString()) {
            throw new RpcException(-32602, "参数 " + key + " 必须是字符串");
        }
        return e.getAsString();
    }

    public String s(String key, String fallback) throws RpcException {
        return has(key) ? s(key) : fallback;
    }

    public boolean b(String key, boolean fallback) throws RpcException {
        if (!has(key)) {
            return fallback;
        }
        JsonElement e = o.get(key);
        if (e.isJsonPrimitive() && e.getAsJsonPrimitive().isBoolean()) {
            return e.getAsBoolean();
        }
        throw new RpcException(-32602, "参数 " + key + " 必须是布尔值");
    }

    public JsonObject obj(String key) throws RpcException {
        if (!has(key)) {
            return null;
        }
        JsonElement e = o.get(key);
        if (!e.isJsonObject()) {
            throw new RpcException(-32602, "参数 " + key + " 必须是对象");
        }
        return e.getAsJsonObject();
    }

    public JsonArray arr(String key) throws RpcException {
        if (!has(key)) {
            return null;
        }
        JsonElement e = o.get(key);
        if (!e.isJsonArray()) {
            throw new RpcException(-32602, "参数 " + key + " 必须是数组");
        }
        return e.getAsJsonArray();
    }

    private double number(String key) throws RpcException {
        require(key);
        JsonElement e = o.get(key);
        if (!e.isJsonPrimitive() || !e.getAsJsonPrimitive().isNumber()) {
            throw new RpcException(-32602, "参数 " + key + " 必须是数字");
        }
        return e.getAsDouble();
    }

    private void require(String key) throws RpcException {
        if (!has(key)) {
            throw new RpcException(-32602, "缺少必需参数: " + key);
        }
    }
}
