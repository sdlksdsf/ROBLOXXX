#!/usr/bin/env node
/*
 * ROBLOXXX Studio Relay v1.0
 *
 * Connects the cloud AI agent to Roblox Studio's official MCP server through
 * a Supabase relay table:
 *
 *   AI agent  --(SQL via secure connector)-->  Supabase  <--(outbound HTTPS poll)--  THIS script  -->  Studio MCP (localhost)
 *
 * Security model:
 *   - This script makes ONLY outbound HTTPS calls to your Supabase project.
 *     It opens NO ports, NO tunnels, NOTHING is exposed to the internet.
 *   - It spawns your local official Roblox MCP server (mcp.bat) exactly like
 *     the config Roblox gave you.
 *   - It prints every command it executes to your console so you can see
 *     exactly what the AI is doing in your Studio.
 *   - Zero npm dependencies. Needs only Node.js 18+.
 *
 * Usage:
 *   node relay.js               normal run   (needs .env filled in)
 *   node relay.js --diagnose    step-by-step connectivity check
 *   node relay.js --selftest    test the MCP protocol with a fake server
 *                               (no Supabase, no Studio needed)
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].trim().replace(/^["'](.*)["']$/, "$1");
    }
  }
}

function getConfig() {
  loadEnvFile();
  return {
    url: (process.env.SUPABASE_URL || "").replace(/\/+$/, ""),
    key: process.env.SUPABASE_KEY || "",
    secret: process.env.RELAY_SECRET || "",
    mcpCommand:
      process.env.MCP_COMMAND ||
      "cmd.exe /c cd /d %LOCALAPPDATA%\\Roblox && .\\mcp.bat",
    pollMs: Math.max(300, parseInt(process.env.POLL_MS || "700", 10) || 700),
  };
}

function mask(s) {
  if (!s) return "(missing)";
  if (s.length <= 12) return "****";
  return s.slice(0, 8) + "..." + s.slice(-4) + " (" + s.length + " chars)";
}

// ---------------------------------------------------------------------------
// Minimal MCP stdio client (newline-delimited JSON-RPC 2.0, no dependencies)
// ---------------------------------------------------------------------------
class McpClient {
  constructor(command) {
    this.command = command;
    this.nextId = 1;
    this.pending = new Map();
    this.ready = false;
    this.child = null;
  }

  start(timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      };

      this.child = spawn(this.command, {
        shell: true,
        stdio: ["pipe", "pipe", "inherit"],
        windowsHide: true,
      });

      this.child.once("error", (err) =>
        fail(new Error("Could not start MCP server: " + err.message))
      );
      this.child.once("exit", (code) => {
        if (!settled && !this.ready) {
          fail(
            new Error(
              "MCP server exited (code " +
                code +
                ") before answering. Is Roblox Studio open with a place loaded?"
            )
          );
        } else if (this.ready) {
          for (const [, p] of this.pending) {
            p.reject(new Error("MCP server exited (code " + code + ")"));
          }
          this.pending.clear();
        }
      });

      let buf = "";
      this.child.stdout.on("data", (chunk) => {
        buf += chunk.toString();
        let idx;
        while ((idx = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 1);
          if (!line) continue;
          let msg;
          try {
            msg = JSON.parse(line);
          } catch {
            // Some servers print banner lines; never crash on them.
            console.log("[mcp output]", line.slice(0, 200));
            continue;
          }
          if (msg.id !== undefined && this.pending.has(msg.id)) {
            const p = this.pending.get(msg.id);
            this.pending.delete(msg.id);
            if (msg.error) {
              p.reject(
                new Error(msg.error.message || JSON.stringify(msg.error))
              );
            } else {
              p.resolve(msg.result);
            }
          }
        }
      });

      const versions = ["2025-06-18", "2024-11-05"];
      const tryInit = async (i) => {
        const res = await this.request(
          "initialize",
          {
            protocolVersion: versions[i],
            capabilities: {},
            clientInfo: { name: "robloxxx-relay", version: "1.0.0" },
          },
          timeoutMs
        );
        this.notify("notifications/initialized", {});
        this.ready = true;
        return res;
      };

      const timer = setTimeout(
        () =>
          fail(
            new Error(
              "MCP server silent for " +
                timeoutMs / 1000 +
                "s during initialize. Is Studio open?"
            )
          ),
        timeoutMs
      );

      tryInit(0)
        .then((res) => {
          clearTimeout(timer);
          if (res && res.protocolVersion) {
            console.log("[mcp] negotiated protocol " + res.protocolVersion);
          }
          settled = true;
          resolve(res);
        })
        .catch(async (err) => {
          try {
            const res = await tryInit(1);
            clearTimeout(timer);
            settled = true;
            resolve(res);
          } catch (err2) {
            clearTimeout(timer);
            fail(
              new Error(
                "initialize failed: " + err.message + " / retry: " + err2.message
              )
            );
          }
        });
    });
  }

  request(method, params, timeoutMs = 120000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error("Timeout (" + timeoutMs + "ms) on " + method));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(t);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(t);
          reject(e);
        },
      });
      this.child.stdin.write(
        JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"
      );
    });
  }

  notify(method, params) {
    this.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }

  stop() {
    try {
      if (this.child) this.child.kill();
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// Supabase REST helpers (PostgREST, publishable key + RLS)
// ---------------------------------------------------------------------------
class RelayStore {
  constructor(cfg) {
    this.cfg = cfg;
  }

  async req(method, search, body) {
    const res = await fetch(this.cfg.url + "/rest/v1/studio_commands" + search, {
      method,
      headers: {
        apikey: this.cfg.key,
        Authorization: "Bearer " + this.cfg.key,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.text()).slice(0, 300);
      } catch {}
      throw new Error("Supabase " + method + " -> HTTP " + res.status + " " + detail);
    }
    if (method === "GET") return res.json();
    return null;
  }

  async fetchPending() {
    const rows = await this.req(
      "GET",
      "?select=*&status=eq.pending&secret=eq." +
        encodeURIComponent(this.cfg.secret) +
        "&order=id.asc&limit=1"
    );
    return rows && rows.length ? rows[0] : null;
  }

  async claim(id) {
    await this.req("PATCH", "?id=eq." + id, {
      status: "running",
      started_at: new Date().toISOString(),
    });
  }

  async complete(id, result) {
    let payload = result;
    const json = JSON.stringify(result);
    if (json && json.length > 400000) {
      payload = {
        truncated: true,
        note: "Result was " + json.length + " chars; preview below.",
        preview: json.slice(0, 100000),
      };
    }
    await this.req("PATCH", "?id=eq." + id, {
      status: "done",
      result: payload,
      finished_at: new Date().toISOString(),
    });
  }

  async fail(id, message) {
    await this.req("PATCH", "?id=eq." + id, {
      status: "error",
      error: String(message).slice(0, 4000),
      finished_at: new Date().toISOString(),
    });
  }

  async reclaimStuck() {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await this.req(
      "PATCH",
      "?status=eq.running&started_at=lt." + encodeURIComponent(cutoff),
      {
        status: "error",
        error: "Reclaimed: bridge restarted while this command was running.",
        finished_at: new Date().toISOString(),
      }
    );
  }
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------
async function selftest() {
  console.log("— selftest: MCP protocol against local fake server —");
  const fake = "node " + JSON.stringify(path.join(__dirname, "fake-mcp.js"));
  const mcp = new McpClient(fake);
  try {
    await mcp.start(10000);
    console.log("PASS  initialize handshake");
    const list = await mcp.request("tools/list", {}, 10000);
    const names = (list.tools || []).map((t) => t.name);
    if (!names.includes("echo")) throw new Error("tools/list missing echo tool");
    console.log("PASS  tools/list -> " + names.join(", "));
    const call = await mcp.request(
      "tools/call",
      { name: "echo", arguments: { text: "hello relay" } },
      10000
    );
    const text = JSON.stringify(call);
    if (!text.includes("hello relay")) throw new Error("echo roundtrip failed");
    console.log("PASS  tools/call roundtrip");
    console.log("");
    console.log("SELFTEST OK — protocol layer works.");
    console.log("Next: fill in .env, then run: node relay.js --diagnose");
    return 0;
  } catch (err) {
    console.log("FAIL  " + err.message);
    return 1;
  } finally {
    mcp.stop();
  }
}

async function diagnose(cfg) {
  console.log("— diagnose —");
  let failures = 0;
  const step = (ok, label, hint) => {
    console.log((ok ? "PASS  " : "FAIL  ") + label + (ok || !hint ? "" : "\n      -> " + hint));
    if (!ok) failures++;
  };

  step(!!cfg.url, "SUPABASE_URL set: " + (cfg.url || "(missing)"),
    "Put SUPABASE_URL=https://<project-ref>.supabase.co in bridge/.env");
  step(!!cfg.key, "SUPABASE_KEY set: " + mask(cfg.key),
    "Put the publishable key into bridge/.env");
  step(!!cfg.secret, "RELAY_SECRET set: " + mask(cfg.secret),
    "Put the relay token the AI gave you into bridge/.env");

  if (cfg.url && cfg.key) {
    try {
      await fetch(cfg.url + "/rest/v1/studio_commands?select=id&limit=1", {
        headers: { apikey: cfg.key, Authorization: "Bearer " + cfg.key },
      }).then(async (r) => {
        if (r.status === 200) step(true, "Supabase reachable, key accepted, table readable");
        else if (r.status === 401 || r.status === 403)
          step(false, "Supabase rejected the key (HTTP " + r.status + ")",
            "Check SUPABASE_KEY matches the project SUPABASE_URL");
        else step(false, "Supabase HTTP " + r.status + " " + (await r.text()).slice(0, 200),
          "Table missing or schema not created yet — ask the AI to run setup");
      });
    } catch (err) {
      step(false, "Supabase unreachable: " + err.message,
        "Check internet connection / SUPABASE_URL");
    }
  }

  const mcp = new McpClient(cfg.mcpCommand);
  try {
    await mcp.start(20000);
    step(true, "Official Roblox MCP server answered initialize");
    const list = await mcp.request("tools/list", {}, 15000);
    const names = (list.tools || []).map((t) => t.name);
    step(names.length > 0, "MCP tools available: " + names.length + " (" + names.slice(0, 8).join(", ") + (names.length > 8 ? ", …" : "") + ")");
  } catch (err) {
    step(false, "MCP server: " + err.message,
      "Open Roblox Studio with a place loaded, Studio Assistant enabled (… → Settings → MCP Servers)");
  } finally {
    mcp.stop();
  }

  console.log("");
  console.log(failures === 0 ? "DIAGNOSE OK — everything ready. Run: node relay.js" : failures + " problem(s) found — fix and re-run --diagnose");
  return failures === 0 ? 0 : 1;
}

async function run(cfg) {
  if (!cfg.url || !cfg.key || !cfg.secret) {
    console.error("Missing SUPABASE_URL / SUPABASE_KEY / RELAY_SECRET in .env — run --diagnose for details.");
    return 1;
  }
  const store = new RelayStore(cfg);
  console.log("— connecting to official Roblox Studio MCP —");
  const mcp = new McpClient(cfg.mcpCommand);
  await mcp.start(20000);
  console.log("MCP connected. Relay running. Commands from the AI will appear below.");
  console.log("Polling " + cfg.url + " every " + cfg.pollMs + "ms  |  Ctrl+C to stop.");
  try {
    await store.reclaimStuck();
  } catch (err) {
    console.log("[warn] reclaim skipped: " + err.message);
  }

  let running = true;
  process.on("SIGINT", () => {
    console.log("\nStopping relay…");
    running = false;
    mcp.stop();
    setTimeout(() => process.exit(0), 300);
  });

  while (running) {
    let row = null;
    try {
      row = await store.fetchPending();
    } catch (err) {
      console.log("[poll error] " + err.message);
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    if (!row) {
      await new Promise((r) => setTimeout(r, cfg.pollMs));
      continue;
    }

    const t0 = Date.now();
    const stamp = new Date().toLocaleTimeString();
    try {
      await store.claim(row.id);
      let result;
      if (row.tool === "$list_tools") {
        result = await mcp.request("tools/list", {}, 60000);
      } else {
        result = await mcp.request(
          "tools/call",
          { name: row.tool, arguments: row.args || {} },
          180000
        );
      }
      await store.complete(row.id, result);
      console.log(
        "#" + row.id + " [" + stamp + "] " + row.tool + " -> OK (" + (Date.now() - t0) + "ms)"
      );
    } catch (err) {
      try {
        await store.fail(row.id, err.message);
      } catch (err2) {
        console.log("[error] could not report failure: " + err2.message);
      }
      console.log("#" + row.id + " [" + stamp + "] " + row.tool + " -> ERROR: " + err.message);
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
async function main() {
  const argv = process.argv.slice(2);
  const cfg = getConfig();
  if (argv.includes("--selftest")) process.exit(await selftest());
  if (argv.includes("--diagnose")) process.exit(await diagnose(cfg));
  process.exit(await run(cfg));
}

main().catch((err) => {
  console.error("Fatal: " + (err && err.stack ? err.stack : err));
  process.exit(1);
});
