# mcp-toolbox

我自用的 MCP server / Claude Skill 收藏夹。仓库里只登记「怎么启动」和「需要哪些环境变量的名字」，不存任何密钥；密钥留在你本机的环境变量里，装的时候由 Claude Code / Codex 在运行时从本机环境读取。

## 目录结构

```
registry.json        所有条目的索引（MCP server + Skill）
skills/<id>/          每个 Skill 一个文件夹，标准 SKILL.md 格式
install.mjs           安装脚本（零依赖，纯 Node.js，跨 Windows/PowerShell/Git Bash）
```

## 安装

不发布到 npm 官方注册表，直接从 GitHub 装，不需要登录 npm：

```bash
# 全局装一次，得到 mcpt 命令
npm install -g github:limnova/mcp-toolbox

# 或者不装，每次直接用 npx 跑（会用缓存，比较快）
npx github:limnova/mcp-toolbox list
```

也可以本地 clone 后用 `node install.mjs` 代替 `mcpt`，两者等价：

```bash
git clone https://github.com/limnova/mcp-toolbox.git
node mcp-toolbox/install.mjs list
```

## 用法

在**目标项目**的目录下运行（装到当前目录，不是 toolbox 自己的目录）：

```bash
# 看看仓库里有什么
mcpt list

# 交互式选装（不带参数会依次询问要装哪些 MCP / skill / 装到哪）
mcpt add

# 非交互，直接指定（支持单独选几个，不是全装）
mcpt add --mcp filesystem --target claude
mcpt add --mcp filesystem,example-with-secret --skill commit-message --target both

# 已存在同名配置默认跳过，加 --force 覆盖
mcpt add --mcp filesystem --target claude --force
```

- `--target claude`：写入**当前目录**的 `.mcp.json`（项目级，不影响其他项目）。
- `--target codex`：写入 `~/.codex/config.toml`（**全局**——Codex CLI 目前没有项目级 MCP 配置，`codex mcp add` 也只支持写全局配置，这是 Codex 自身的限制，不是这个脚本的选择）。
- `--target both`：两个都写。
- Skill 始终装到当前目录的 `.claude/skills/<id>/`（项目级）。

装完脚本会打印一份环境变量检查表，提示哪些密钥变量本机还没设置。

## 密钥怎么处理

在你本机（不是仓库里）设置环境变量，比如 PowerShell profile 里加：

```powershell
$env:EXAMPLE_API_KEY = "xxx"
```

或 `.bashrc` / `.zshrc` 里：

```bash
export EXAMPLE_API_KEY=xxx
```

- **Claude Code**：`.mcp.json` 里这类字段写的是 `"${EXAMPLE_API_KEY}"`，Claude Code 启动 MCP server 时会从当前环境变量里展开这个占位符，密钥值本身不会落进 `.mcp.json` 文件。
- **Codex**：`config.toml` 里写的是 `env_vars = ["EXAMPLE_API_KEY"]`，这是变量名的白名单，Codex 启动子进程时会从当前 shell 环境里把这些变量透传过去，同样不写字面值。

## 新增一个条目

**MCP server**：在 `registry.json` 的 `mcpServers` 数组里加一项：

```json
{
  "id": "my-server",
  "name": "My Server",
  "description": "一句话说明这是干嘛的",
  "command": "npx",
  "args": ["-y", "@scope/my-mcp-server"],
  "envVars": ["MY_SERVER_TOKEN"],
  "tags": ["example"]
}
```

不需要密钥就把 `envVars` 留空数组。

**Skill**：新建 `skills/<id>/SKILL.md`（标准 Claude Skill frontmatter + 正文），再在 `registry.json` 的 `skills` 数组里加一条 `{ "id", "name", "description", "path": "skills/<id>" }`。

## 已收录

跑 `node install.mjs list` 看当前最新列表；这个 README 不重复维护一份，避免和 `registry.json` 脱节。
