# MCP Bridge — MCP 服务器

把 MCP 工具调用翻译成对游戏内 Fabric 模组的 HTTP 请求。默认走 **stdio**（给 Claude Desktop 用），加 `--http` 可切到 Streamable HTTP。

## 配置

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `MCPBRIDGE_URL` | `http://127.0.0.1:8765` | 模组内嵌 HTTP 服务的地址 |
| `MCPBRIDGE_TOKEN` | — | Bearer 令牌，优先使用 |
| `MCPBRIDGE_TIMEOUT_MS` | `10000` | 单次请求超时（应大于模组侧的 `requestTimeoutMs`） |
| `MCPBRIDGE_GAME_DIR` | — | `.minecraft` 目录，用于自动发现 `config/mcpbridge.token` |
| `MCPBRIDGE_CONFIG` | — | `mcpbridge.json` 的完整路径 |
| `MCPBRIDGE_HTTP_PORT` | `3000` | 仅 `--http` 模式生效 |

不设 `MCPBRIDGE_TOKEN` 时，会按以下顺序寻找令牌：
`MCPBRIDGE_CONFIG` → `MCPBRIDGE_GAME_DIR/config` → `%APPDATA%/.minecraft/config` →
`~/Library/Application Support/minecraft/config` → `~/.minecraft/config` → 当前目录 →
`../fabric/run/config`（开发态）。

## 运行

```bash
npm install
npm run build
node dist/index.js            # stdio
node dist/index.js --http     # HTTP，默认 127.0.0.1:3000/mcp
npm run dev                   # tsx 热跑
```

## 结构

```
src/
  config.ts   环境变量与令牌发现
  bridge.ts   HTTP + JSON-RPC 客户端（超时、错误码映射）
  tools.ts    工具定义（与模组侧方法一一对应）
  index.ts    MCP server 装配与传输层
```

新增工具：在 `tools.ts` 的 `TOOLS` 数组里加一条 `ToolDef` 即可，`name` 必须与模组侧注册的方法名一致。

## 注意

- 这个进程不持有任何游戏状态，随时可以重启，游戏不受影响。
- 传输层用 stdio 时，**不要往 stdout 打印任何东西**（会破坏协议），日志一律走 stderr——`index.ts` 里的 `console.error` 正是为此。
