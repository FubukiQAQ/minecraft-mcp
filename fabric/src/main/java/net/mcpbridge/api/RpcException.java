package net.mcpbridge.api;

/**
 * 会被转换成 JSON-RPC error 对象的异常。
 * code 沿用 JSON-RPC 2.0 规范：-32700 解析错误 / -32600 无效请求 / -32601 方法不存在 /
 * -32602 参数无效 / -32603 内部错误；-32000 及以上留给业务自定义。
 */
public class RpcException extends Exception {

    /** 未授权（令牌错误或缺失）。 */
    public static final int UNAUTHORIZED = -32010;
    /** 权限等级不足。 */
    public static final int FORBIDDEN = -32011;
    /** 主线程执行超时。 */
    public static final int TIMEOUT = -32001;
    /** 世界/玩家尚未就绪。 */
    public static final int NOT_READY = -32002;

    public final int code;

    public RpcException(int code, String message) {
        super(message);
        this.code = code;
    }

    public RpcException(int code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }
}
