package net.mcpbridge.core;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.ArrayDeque;
import java.util.Deque;

/**
 * 事件环形缓冲。
 *
 * 外部 AI 是"拉"模型：它不会一直连着游戏，所以把聊天、死亡、进出服这些瞬时事件
 * 攒成一个有序号的队列，让它随时用 get_events 增量拉取。
 */
public final class EventLog {

    private static final Deque<JsonObject> BUFFER = new ArrayDeque<>();
    private static int capacity = 500;
    private static int seq = 0;
    private static boolean enabled = true;

    private EventLog() {
    }

    public static synchronized void configure(boolean logEnabled, int size) {
        enabled = logEnabled;
        capacity = Math.max(16, size);
        while (BUFFER.size() > capacity) {
            BUFFER.pollFirst();
        }
    }

    /** 记录一条事件，返回它的序号。 */
    public static synchronized int record(String type, JsonObject data) {
        if (!enabled) {
            return seq;
        }
        JsonObject entry = new JsonObject();
        entry.addProperty("seq", ++seq);
        entry.addProperty("t", System.currentTimeMillis());
        entry.addProperty("type", type);
        entry.add("data", data == null ? new JsonObject() : data);
        BUFFER.addLast(entry);
        while (BUFFER.size() > capacity) {
            BUFFER.pollFirst();
        }
        return seq;
    }

    /** 取回 seq 大于 since 的最多 limit 条事件。 */
    public static synchronized JsonArray since(int since, int limit) {
        JsonArray out = new JsonArray();
        for (JsonObject e : BUFFER) {
            if (e.get("seq").getAsInt() <= since) {
                continue;
            }
            out.add(e);
            if (out.size() >= limit) {
                break;
            }
        }
        return out;
    }

    public static synchronized int latestSeq() {
        return seq;
    }

    public static synchronized void clear() {
        BUFFER.clear();
    }
}
