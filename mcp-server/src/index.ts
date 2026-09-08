#!/usr/bin/env node
import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { loadConfig } from "./config.js";
import { BridgeError, call, health } from "./bridge.js";
import { TOOLS } from "./tools.js";

const VERSION = "0.1.0";

function buildServer(): McpServer {
  const server = new McpServer({ name: "mcpbridge", version: VERSION });

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
      },
      async (args: Record<string, unknown>) => {
        try {
          const result = await call(tool.name, args ?? {}, cfg);
          return {
            content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
          };
        } catch (e) {
          const message = e instanceof BridgeError ? e.message : `调用失败: ${String(e)}`;
          return {
            isError: true,
            content: [{ type: "text" as const, text: message }],
          };
        }
      },
    );
  }
  return server;
}

const cfg = loadConfig();

async function main(): Promise<void> {
  const useHttp = process.argv.includes("--http");
  const server = buildServer();

  if (useHttp) {
    const port = Number.parseInt(process.env.MCPBRIDGE_HTTP_PORT ?? "3000", 10);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);

    const httpServer = createServer(async (req, res) => {
      try {
        if (req.method === "POST") {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(chunk as Buffer);
          }
          const body = Buffer.concat(chunks).toString("utf8");
          await transport.handleRequest(req, res, body ? JSON.parse(body) : undefined);
          return;
        }
        await transport.handleRequest(req, res);
      } catch (e) {
        if (!res.headersSent) {
          res.writeHead(500).end("internal error");
        }
        console.error("[mcpbridge] HTTP 处理失败", e);
      }
    });
    httpServer.listen(port, "127.0.0.1", () => {
      console.error(`[mcpbridge] MCP over HTTP: http://127.0.0.1:${port}/mcp`);
    });
    return;
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[mcpbridge] 已就绪（stdio）。桥地址=${cfg.url}，令牌来源=${cfg.tokenSource}`);

  // 启动后探一次活，方便用户在客户端里第一时间看到明确提示
  try {
    const h = await health(cfg);
    console.error(`[mcpbridge] 游戏侧状态: ${JSON.stringify(h)}`);
  } catch {
    console.error("[mcpbridge] 警告：暂时连不上游戏内的桥，请确认 Minecraft 已启动并加载了模组。");
  }
}

main().catch((e) => {
  console.error("[mcpbridge] 启动失败:", e instanceof Error ? e.message : e);
  process.exit(1);
});
