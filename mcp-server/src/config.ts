import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface BridgeConfig {
  /** 模组内嵌 HTTP 服务的地址。 */
  url: string;
  /** Bearer 令牌。 */
  token: string;
  /** 单次请求超时（毫秒）。 */
  timeoutMs: number;
  /** 令牌来源，便于出错时给出可操作的提示。 */
  tokenSource: string;
}

/** 模组默认监听地址，可用 MCPBRIDGE_URL 覆盖。 */
const DEFAULT_URL = "http://127.0.0.1:8765";

export function loadConfig(): BridgeConfig {
  const url = (process.env.MCPBRIDGE_URL ?? DEFAULT_URL).replace(/\/+$/, "");
  const timeoutMs = Number.parseInt(process.env.MCPBRIDGE_TIMEOUT_MS ?? "10000", 10);

  const fromEnv = process.env.MCPBRIDGE_TOKEN;
  if (fromEnv && fromEnv.trim().length > 0) {
    return { url, token: fromEnv.trim(), timeoutMs, tokenSource: "环境变量 MCPBRIDGE_TOKEN" };
  }

  const found = discoverToken();
  if (!found) {
    throw new Error(
      [
        "找不到 MCP Bridge 的认证令牌。请任选一种方式提供：",
        "  1) 设置环境变量 MCPBRIDGE_TOKEN=<令牌>",
        "  2) 设置 MCPBRIDGE_GAME_DIR=<.minecraft 目录>，使其包含 config/mcpbridge.token",
        "  3) 设置 MCPBRIDGE_CONFIG=<mcpbridge.json 的完整路径>",
        "令牌在游戏首次启动后由模组生成，同时会打印在日志里。",
      ].join("\n"),
    );
  }
  return { url, token: found.token, timeoutMs, tokenSource: found.path };
}

function discoverToken(): { token: string; path: string } | null {
  for (const dir of candidateDirs()) {
    const tokenFile = join(dir, "mcpbridge.token");
    if (existsSync(tokenFile)) {
      const token = readFileSync(tokenFile, "utf8").trim();
      if (token) {
        return { token, path: tokenFile };
      }
    }
    const jsonFile = join(dir, "mcpbridge.json");
    if (existsSync(jsonFile)) {
      try {
        const parsed = JSON.parse(readFileSync(jsonFile, "utf8")) as { token?: string };
        if (parsed.token) {
          return { token: parsed.token, path: jsonFile };
        }
      } catch {
        // 配置损坏就继续找下一个候选
      }
    }
  }
  return null;
}

function candidateDirs(): string[] {
  const dirs: string[] = [];
  const push = (p?: string | null) => {
    if (p) {
      dirs.push(join(p, "config"));
      dirs.push(p);
    }
  };

  if (process.env.MCPBRIDGE_CONFIG) {
    dirs.push(process.env.MCPBRIDGE_CONFIG);
    dirs.push(join(process.env.MCPBRIDGE_CONFIG, "config"));
  }
  push(process.env.MCPBRIDGE_GAME_DIR);
  push(process.env.APPDATA ? join(process.env.APPDATA, ".minecraft") : null);
  push(join(homedir(), "Library", "Application Support", "minecraft"));
  push(join(homedir(), ".minecraft"));
  push(process.cwd());
  // 开发态：fabric/run 下的运行目录
  push(join(process.cwd(), "..", "fabric", "run"));
  push(join(process.cwd(), "..", "run"));
  return dirs.filter((d, i) => d && dirs.indexOf(d) === i);
}
