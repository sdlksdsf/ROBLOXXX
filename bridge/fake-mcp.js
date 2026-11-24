#!/usr/bin/env node
/*
 * Fake MCP server used by `node relay.js --selftest`.
 * Speaks the same newline-delimited JSON-RPC stdio protocol as the real
 * Roblox Studio MCP server, so the relay can be verified without Studio.
 */
"use strict";

const readline = require("readline");

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }

  if (msg.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: {
        protocolVersion:
          (msg.params && msg.params.protocolVersion) || "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "fake-mcp", version: "1.0.0" },
      },
    });
  } else if (msg.method === "notifications/initialized") {
    // ok
  } else if (msg.method === "tools/list") {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: {
        tools: [
          {
            name: "echo",
            description: "Echoes arguments back (selftest only)",
            inputSchema: {
              type: "object",
              properties: { text: { type: "string" } },
              required: ["text"],
            },
          },
        ],
      },
    });
  } else if (msg.method === "tools/call") {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: {
        content: [
          {
            type: "text",
            text: "echo: " + JSON.stringify((msg.params && msg.params.arguments) || {}),
          },
        ],
        isError: false,
      },
    });
  } else if (msg.id !== undefined) {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      error: { code: -32601, message: "Method not found: " + msg.method },
    });
  }
});
