#!/usr/bin/env node
// Zero-dependency installer for this toolbox's MCP servers and Claude skills.
// Usage:
//   node install.mjs list
//   node install.mjs add [--mcp id1,id2] [--skill id1,id2] [--target claude|codex|both] [--force]
//   (running `add` with no --mcp/--skill prompts interactively)

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();

function parseArgs(argv) {
  const out = { _: [], force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--mcp") out.mcp = argv[++i];
    else if (a === "--skill") out.skill = argv[++i];
    else if (a === "--target") out.target = argv[++i];
    else if (a === "--force") out.force = true;
    else out._.push(a);
  }
  return out;
}

function splitIds(s) {
  return (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

async function loadRegistry() {
  const raw = await fs.readFile(path.join(repoRoot, "registry.json"), "utf8");
  return JSON.parse(raw);
}

function printList(registry) {
  console.log("\nMCP servers:");
  for (const m of registry.mcpServers) {
    const env = m.envVars?.length ? `  [env: ${m.envVars.join(", ")}]` : "";
    console.log(`  ${m.id.padEnd(22)} ${m.description}${env}`);
  }
  console.log("\nSkills:");
  for (const s of registry.skills) {
    console.log(`  ${s.id.padEnd(22)} ${s.description}`);
  }
  console.log("");
}

async function promptSelection(registry) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  printList(registry);
  const mcp = await rl.question("要安装的 MCP id（逗号分隔，回车跳过）: ");
  const skill = await rl.question("要安装的 skill id（逗号分隔，回车跳过）: ");
  const target = await rl.question("装到 claude / codex / both？（默认 claude）: ");
  rl.close();
  return { mcp, skill, target: target.trim() || "claude" };
}

async function installClaude(mcpEntries, force) {
  if (!mcpEntries.length) return;
  const mcpJsonPath = path.join(cwd, ".mcp.json");
  let config = { mcpServers: {} };
  try {
    config = JSON.parse(await fs.readFile(mcpJsonPath, "utf8"));
    config.mcpServers ??= {};
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  for (const entry of mcpEntries) {
    if (config.mcpServers[entry.id] && !force) {
      console.log(`  [claude] 跳过 ${entry.id}：.mcp.json 已存在同名项（加 --force 覆盖）`);
      continue;
    }
    const server = { type: "stdio", command: entry.command, args: entry.args };
    if (entry.envVars?.length) {
      server.env = Object.fromEntries(entry.envVars.map((v) => [v, `\${${v}}`]));
    }
    config.mcpServers[entry.id] = server;
    console.log(`  [claude] 写入 ${entry.id} -> ${mcpJsonPath}`);
  }
  await fs.writeFile(mcpJsonPath, JSON.stringify(config, null, 2) + "\n");
}

async function installCodex(mcpEntries, force) {
  if (!mcpEntries.length) return;
  const codexPath = path.join(os.homedir(), ".codex", "config.toml");
  await fs.mkdir(path.dirname(codexPath), { recursive: true });
  let content = "";
  try {
    content = await fs.readFile(codexPath, "utf8");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  let changed = false;
  for (const entry of mcpEntries) {
    const header = `[mcp_servers.${entry.id}]`;
    if (content.includes(header) && !force) {
      console.log(`  [codex] 跳过 ${entry.id}：config.toml 已存在同名段落（加 --force 追加一份，需自行去重）`);
      continue;
    }
    const argsToml = entry.args.map((a) => JSON.stringify(a)).join(", ");
    let block = `\n${header}\ncommand = ${JSON.stringify(entry.command)}\nargs = [${argsToml}]\n`;
    if (entry.envVars?.length) {
      block += `env_vars = [${entry.envVars.map((v) => JSON.stringify(v)).join(", ")}]\n`;
    }
    content += block;
    changed = true;
    console.log(`  [codex] 写入 ${entry.id} -> ${codexPath}（全局配置，Codex 不支持按项目单独配置）`);
  }
  if (changed) await fs.writeFile(codexPath, content);
}

async function installSkills(skillEntries, force) {
  for (const skill of skillEntries) {
    const src = path.join(repoRoot, skill.path);
    const dest = path.join(cwd, ".claude", "skills", skill.id);
    const exists = await fs.access(dest).then(() => true).catch(() => false);
    if (exists && !force) {
      console.log(`  [skill] 跳过 ${skill.id}：${dest} 已存在（加 --force 覆盖）`);
      continue;
    }
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.cp(src, dest, { recursive: true, force: true });
    console.log(`  [skill] 安装 ${skill.id} -> ${dest}`);
  }
}

function checkEnvVars(mcpEntries) {
  const needed = [...new Set(mcpEntries.flatMap((e) => e.envVars || []))];
  if (!needed.length) return;
  console.log("\n环境变量检查（需要你本机已 export，密钥本身不会存进这个仓库）:");
  for (const v of needed) {
    console.log(`  ${process.env[v] ? "✅" : "⚠️ 未设置"}  ${v}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  const registry = await loadRegistry();

  if (!command || command === "list") {
    printList(registry);
    return;
  }

  if (command !== "add") {
    console.error(`未知命令: ${command}\n用法: node install.mjs list | add`);
    process.exit(1);
  }

  let { mcp, skill, target } = args;
  if (mcp === undefined && skill === undefined) {
    ({ mcp, skill, target } = await promptSelection(registry));
  }
  target ??= "claude";

  const mcpIds = splitIds(mcp);
  const skillIds = splitIds(skill);
  const mcpEntries = registry.mcpServers.filter((m) => mcpIds.includes(m.id));
  const skillEntries = registry.skills.filter((s) => skillIds.includes(s.id));

  const missingMcp = mcpIds.filter((id) => !mcpEntries.some((m) => m.id === id));
  const missingSkill = skillIds.filter((id) => !skillEntries.some((s) => s.id === id));
  if (missingMcp.length) console.log(`忽略未知 MCP id: ${missingMcp.join(", ")}`);
  if (missingSkill.length) console.log(`忽略未知 skill id: ${missingSkill.join(", ")}`);

  if (target === "claude" || target === "both") await installClaude(mcpEntries, args.force);
  if (target === "codex" || target === "both") await installCodex(mcpEntries, args.force);
  await installSkills(skillEntries, args.force);
  checkEnvVars(mcpEntries);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
