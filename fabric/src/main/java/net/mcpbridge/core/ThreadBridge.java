package net.mcpbridge.core;

import net.mcpbridge.api.RpcException;
import net.minecraft.server.MinecraftServer;

import java.util.concurrent.Callable;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * 线程桥：把任意任务丢到游戏主线程执行，并同步等待结果。
 *
 * Minecraft 的世界状态不是线程安全的，任何读写都必须发生在主线程，
 * 这是整个模组最容易出事、也最必须做对的地方。
 */
public final class ThreadBridge {

    private static volatile MinecraftServer server;

    private ThreadBridge() {
    }

    public static void setServer(MinecraftServer s) {
        server = s;
    }

    public static MinecraftServer server() {
        return server;
    }

    public static boolean hasServer() {
        return server != null;
    }

    /**
     * 在主线程执行任务并等待返回值。
     *
     * @throws RpcException  没有可用的执行上下文
     * @throws TimeoutException 主线程在超时时间内没有完成任务
     * @throws Exception     任务内部抛出的异常（会被包装成 ExecutionException）
     */
    public static <T> T call(Callable<T> task, long timeoutMs) throws Exception {
        CompletableFuture<T> future = new CompletableFuture<>();
        Runnable wrapped = () -> {
            try {
                future.complete(task.call());
            } catch (Throwable t) {
                future.completeExceptionally(t);
            }
        };

        MinecraftServer s = server;
        if (s != null) {
            s.execute(wrapped);
        } else if (!ClientExecutor.execute(wrapped)) {
            throw new RpcException(RpcException.NOT_READY,
                    "游戏尚未就绪：没有正在运行的世界。请先进入单人世界或启动服务端。");
        }
        return future.get(timeoutMs, TimeUnit.MILLISECONDS);
    }
}
