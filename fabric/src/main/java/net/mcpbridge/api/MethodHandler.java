package net.mcpbridge.api;

import com.google.gson.JsonObject;

/** 单个方法的执行体。始终在**游戏主线程**上被调用。 */
@FunctionalInterface
public interface MethodHandler {
    JsonObject handle(Args args) throws Exception;
}
