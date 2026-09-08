package net.mcpbridge.http;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import net.mcpbridge.api.Args;
import net.mcpbridge.api.MethodRegistry;
import net.mcpbridge.api.RpcException;
import net.mcpbridge.config.ModConfig;
import net.mcpbridge.core.EventLog;
import net.mcpbridge.core.ThreadBridge;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 模组内嵌的 HTTP 桥。
 *
 * 用 JDK 自带的 com.sun.net.httpserver，零依赖、够轻。默认只绑定 127.0.0.1，
 * 所有写操作都必须带上 Bearer 令牌。
 */
public final class BridgeHttpServer {

    private static final Logger LOGGER = LoggerFactory.getLogger("mcpbridge");
    private static final int MAX_BODY_BYTES = 1 << 20;

    private final ModConfig cfg;
    private final HttpServer server;
    private final ExecutorService pool;

    public BridgeHttpServer(ModConfig cfg) throws IOException {
        this.cfg = cfg;
        InetAddress address = InetAddress.getByName(cfg.bindAddress);
        if (!cfg.allowRemoteBinding && !address.isLoopbackAddress()) {
            throw new IOException("拒绝绑定非回环地址 " + cfg.bindAddress
                    + "：如需远程访问，请在 config/mcpbridge.json 中显式设置 allowRemoteBinding=true 并配置强令牌。");
        }
        this.server = HttpServer.create(new InetSocketAddress(address, cfg.port), 0);
        this.pool = Executors.newFixedThreadPool(4, r -> {
            Thread t = new Thread(r, "mcpbridge-http");
            t.setDaemon(true);
            return t;
        });
        server.createContext("/rpc", this::handleRpc);
        server.createContext("/health", this::handleHealth);
        server.createContext("/methods", this::handleMethods);
    }

    /** 启动并返回实际监听的端口（配置 port=0 时由系统分配）。 */
    public int start() {
        server.setExecutor(pool);
        server.start();
        return server.getAddress().getPort();
    }

    public void stop() {
        server.stop(0);
        pool.shutdownNow();
    }

    // ------------------------------------------------------------------ 路由

    private void handleHealth(HttpExchange ex) throws IOException {
        JsonObject j = new JsonObject();
        j.addProperty("status", "ok");
        j.addProperty("mod", "mcpbridge");
        j.addProperty("methods", MethodRegistry.all().size());
        j.addProperty("permission", cfg.permission().name().toLowerCase());
        j.addProperty("worldReady", ThreadBridge.hasServer());
        send(ex, 200, j);
    }

    private void handleMethods(HttpExchange ex) throws IOException {
        if (!authorized(ex)) {
            send(ex, 401, errorJson("缺少或错误的 Bearer 令牌"));
            return;
        }
        JsonObject j = new JsonObject();
        j.add("methods", MethodRegistry.toJson());
        send(ex, 200, j);
    }

    private void handleRpc(HttpExchange ex) throws IOException {
        try {
            String method = ex.getRequestMethod();
            if ("OPTIONS".equalsIgnoreCase(method)) {
                send(ex, 204, null);
                return;
            }
            if (!"POST".equalsIgnoreCase(method)) {
                send(ex, 405, errorJson("只支持 POST"));
                return;
            }
            if (!authorized(ex)) {
                send(ex, 401, errorJson("缺少或错误的 Bearer 令牌"));
                return;
            }

            String body = readBody(ex);
            JsonObject request;
            try {
                request = JsonParser.parseString(body).getAsJsonObject();
            } catch (Exception e) {
                send(ex, 400, rpcError(null, -32700, "JSON 解析失败: " + e.getMessage()));
                return;
            }

            JsonElement id = request.get("id");
            String name = request.has("method") ? request.get("method").getAsString() : null;
            JsonObject params = request.has("params") && request.get("params").isJsonObject()
                    ? request.get("params").getAsJsonObject()
                    : new JsonObject();

            JsonObject result;
            try {
                result = MethodRegistry.dispatch(name, new Args(params), cfg.permission(), cfg.requestTimeoutMs);
            } catch (RpcException e) {
                send(ex, 200, rpcError(id, e.code, e.getMessage()));
                return;
            } catch (Exception e) {
                LOGGER.warn("[mcpbridge] 方法 {} 执行失败: {}", name, e.toString());
                send(ex, 200, rpcError(id, -32603, String.valueOf(e.getMessage())));
                return;
            }

            JsonObject response = new JsonObject();
            response.addProperty("jsonrpc", "2.0");
            if (id != null) {
                response.add("id", id);
            }
            response.add("result", result);
            send(ex, 200, response);
        } catch (Throwable t) {
            LOGGER.error("[mcpbridge] 处理请求时发生未捕获异常", t);
            try {
                send(ex, 500, errorJson(String.valueOf(t.getMessage())));
            } catch (IOException ignored) {
                // 连接已断开，无需处理
            }
        }
    }

    // ------------------------------------------------------------------ 工具

    private boolean authorized(HttpExchange ex) {
        String header = ex.getRequestHeaders().getFirst("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            return false;
        }
        String provided = header.substring("Bearer ".length()).trim();
        byte[] a = provided.getBytes(StandardCharsets.UTF_8);
        byte[] b = cfg.token.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(a, b);
    }

    private static String readBody(HttpExchange ex) throws IOException {
        try (InputStream in = ex.getRequestBody()) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int total = 0;
            int n;
            while ((n = in.read(buffer)) > 0) {
                total += n;
                if (total > MAX_BODY_BYTES) {
                    throw new IOException("请求体超过 " + MAX_BODY_BYTES + " 字节上限");
                }
                out.write(buffer, 0, n);
            }
            return out.toString(StandardCharsets.UTF_8);
        }
    }

    private static void send(HttpExchange ex, int code, JsonObject payload) throws IOException {
        ex.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
        ex.getResponseHeaders().add("Access-Control-Allow-Headers", "authorization,content-type");
        ex.getResponseHeaders().add("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
        ex.getResponseHeaders().add("Cache-Control", "no-store");
        if (payload == null) {
            ex.sendResponseHeaders(code, -1);
            ex.close();
            return;
        }
        byte[] bytes = payload.toString().getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
        ex.sendResponseHeaders(code, bytes.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(bytes);
        }
        ex.close();
    }

    private static JsonObject rpcError(JsonElement id, int code, String message) {
        JsonObject error = new JsonObject();
        error.addProperty("code", code);
        error.addProperty("message", message);
        JsonObject response = new JsonObject();
        response.addProperty("jsonrpc", "2.0");
        if (id != null) {
            response.add("id", id);
        }
        response.add("error", error);
        return response;
    }

    private static JsonObject errorJson(String message) {
        JsonObject j = new JsonObject();
        j.addProperty("ok", false);
        j.addProperty("error", message);
        return j;
    }
}
