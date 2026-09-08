import type { BridgeConfig } from "./config.js";

export class BridgeError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
    this.name = "BridgeError";
  }
}

interface RpcResponse {
  jsonrpc: string;
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

let requestId = 0;

/** 调用模组内嵌 HTTP 桥上的一个方法。 */
export async function call(
  method: string,
  params: Record<string, unknown>,
  cfg: BridgeConfig,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${cfg.url}/rpc`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${cfg.token}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === "AbortError") {
      throw new BridgeError(
        `请求超时（${cfg.timeoutMs}ms）。游戏是否卡住，或者 MCP Bridge 模组没在运行？`,
      );
    }
    throw new BridgeError(
      `连不上游戏内的桥（${cfg.url}）：${e instanceof Error ? e.message : String(e)}。请确认 Minecraft 已启动且模组已加载。`,
    );
  }
  clearTimeout(timer);

  if (response.status === 401) {
    throw new BridgeError("令牌被拒绝（401）。请检查 MCPBRIDGE_TOKEN 与 config/mcpbridge.token 是否一致。");
  }
  if (!response.ok) {
    throw new BridgeError(`桥返回了 HTTP ${response.status}: ${await response.text().catch(() => "")}`);
  }

  const body = (await response.json()) as RpcResponse;
  if (body.error) {
    throw new BridgeError(
      `游戏侧报错 [${body.error.code}]: ${body.error.message}`,
      body.error.code,
    );
  }
  return body.result;
}

/** 探活：不需要令牌，用来确认"模组在不在"。 */
export async function health(cfg: BridgeConfig): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(`${cfg.url}/health`, { signal: controller.signal });
    return (await res.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}
