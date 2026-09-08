package net.mcpbridge.core;

import java.lang.reflect.Method;

/**
 * 客户端侧的兜底执行器。
 *
 * 专用服务端上没有 net.minecraft.client.MinecraftClient 这个类，直接引用会在服务端触发
 * NoClassDefFoundError，所以这里一律走反射。单人世界下我们会优先用
 * MinecraftServer，只有"客户端连接到远程服务器"这种场景才会用到它。
 */
final class ClientExecutor {

    private ClientExecutor() {
    }

    static boolean execute(Runnable task) {
        try {
            Class<?> clientClass = Class.forName("net.minecraft.client.MinecraftClient");
            Method getInstance = clientClass.getMethod("getInstance");
            Object instance = getInstance.invoke(null);
            if (instance == null) {
                return false;
            }
            Method execute = clientClass.getMethod("execute", Runnable.class);
            execute.invoke(instance, task);
            return true;
        } catch (Throwable t) {
            return false;
        }
    }
}
