# AGENTS.md

给在此仓库里写代码的 AI Agent 提供上下文与硬性约定。改代码前先读一遍，并保持与 `README.md`、`mcp-server/README.md` 一致。

## 这是什么

MCP Bridge：让外部 AI（Claude Desktop / Cursor 等）通过 MCP 协议观察并操控 Minecraft 世界。

- `fabric/`：Fabric 模组（Java，MC 1.20.1），游戏内起本地 HTTP 桥，所有操作调度到主线程。
- `mcp-server/`：TypeScript MCP 服务器，把 MCP 工具调用翻译成对桥的 JSON-RPC 2.0 请求。

## 构建

```bash
cd fabric && ./gradlew build          # Windows 用 gradlew.bat；本机 JDK 路径已写进 gradle.properties
cd mcp-server && npm install && npm run build
cd mcp-server && npm run typecheck    # TS 侧类型检查
```

产物：`fabric/build/libs/mcpbridge-0.1.0.jar`；MCP 服务器入口：`mcp-server/dist/index.js`。

## 硬性约定

1. **方法名两侧必须同名**：模组侧 `MethodRegistry.register(name, ...)` 与 `mcp-server/src/tools.ts` 的 `ToolDef.name` 一一对应，新增或改名要同时改两边。
2. **权限判定只在模组侧**：`Permission.READ/BUILD/ADMIN` + 配置 `permissionLevel`；TS 侧的 `permission` 字段只是文档，不代表实际闸门。
3. **所有游戏状态操作必须走 `core/ThreadBridge`**：方法闭包在主线程执行；禁止在 HTTP 线程直接读写世界。
4. **MCP 服务器日志一律走 stderr**：stdio 传输下 stdout 是协议通道，任何 `console.log` 都会弄坏协议。
5. **新增工具后同步文档**：`README.md` 的工具清单、权限表与 `mcp-server/README.md` 都要跟着更新。

## 新增工具的步骤

1. 模组侧：在 `ReadMethods` / `BuildMethods` / `AdminMethods` 的 `register()` 里调用 `MethodRegistry.register(...)`，注明权限等级与参数 schema。
2. TS 侧：在 `mcp-server/src/tools.ts` 的 `TOOLS` 里加同名 `ToolDef`。
3. 重建两侧；用 `list_methods` 拉取模组侧真实 schema 核对一致性。

## 调试

- 直连桥：`node tools/call.mjs <method> [paramsJson]`，需要 `MCPBRIDGE_TOKEN` 或 `MCPBRIDGE_GAME_DIR`。
- 探活：`curl http://127.0.0.1:8765/health`。
- 令牌：首次启动写入 `config/mcpbridge.token`。PCL2 是版本隔离目录，配置文件在版本目录下的 `config/`。
- 开发态跑 MCP 服务器：`npm run dev`（tsx）。

## 已知坑

- **Yarn 映射名**：不确定 API 时先用 `tools/maptool.mjs` 查 `mappings.tiny`（下载方式见文件头注释），不要凭印象写方法名。
- **Fabric API 事件签名**：以 `javap` 反编译 jar-in-jar 内的实际接口为准，例如 1.20.1 的聊天事件参数。
- **本机 JDK**：`C:\Program Files\Java` 下有 JDK 21；构建用它、产物按 Java 17 编译；`gradle.properties` 已固定路径，PATH 上默认没有 `javap`。
- **Gradle 下载慢**：wrapper 指向腾讯镜像（`mirrors.cloud.tencent.com`），官方源很慢；需要时改 `distributionUrl`。
- **单人世界 vs 专用服务端**：客户端兜底走反射；纯客户端连远程服务器时只能做客户端能做的事。
- **原版命令代替直接调 API**：`set_time` / `set_weather` / `send_chat` 通过派发原版命令实现，避开版本间 API 差异，改动要小心。
- **`fill_blocks` 只能应用统一的 properties**：不同朝向或部位的方块（楼梯、床）要拆成多次调用。
- **请求有硬上限**：`maxScanVolume` / `maxFillVolume` / `maxRaycastDistance` 等护栏别在测试里一次塞超限请求。
