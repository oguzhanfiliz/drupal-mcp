# Drupal MCP Server

A secure **Model Context Protocol (MCP) Server** that exposes multiple DDEV-managed Drupal projects to LLMs (Claude, ChatGPT, etc.).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

**English** | [Türkçe](README.tr.md)

## 📋 Table of Contents

- [Features](#-features)
- [Quick Start](#-quick-start)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [MCP Tools](#-mcp-tools)
- [Security](#-security)
- [Docker Usage](#-docker-usage)
- [Examples](#-examples)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

### 🎯 Multi-Site Support
- **Auto-Discovery**: Automatically finds all DDEV projects via `ddev list`
- **Manual Configuration**: Add sites manually if needed
- **Site Filtering**: Lists only Drupal projects (Drupal 8/9/10/11)
- **Status Tracking**: Shows running/stopped status

### 🛠️ 11 Powerful MCP Tools
1. **drupal_list_sites** - List discovered DDEV sites
2. **drupal_refresh_sites** - Re-discover site list
3. **drupal_project_info** - Get Drupal version, modules, environment info
4. **drupal_search_code** - Search in custom code (ripgrep/grep)
5. **drupal_read_file** - Read files with PII/secret masking
6. **drupal_list_custom_components** - List custom modules and themes
7. **drupal_config_get** - Read config (from sync directory or database)
8. **drupal_db_schema** - Database schema introspection with PII tagging
9. **drupal_drush** - Execute Drush commands (with safe allowlist)
10. **drupal_entity_schema_summary** - Content model summary
11. **drupal_view_export** - List and export Views

### 🔒 Comprehensive Security
- **Token Authentication**: Bearer token API security
- **RBAC (Role-Based Access Control)**: Tool-level permissions
- **PII/Secret Redaction**: Automatic sensitive data masking
- **Path Guard**: Path traversal protection
- **Rate Limiting**: Per-minute request limits
- **Audit Logging**: Detailed operation logging
- **Safe Mode**: Drush command allowlist

### 🚀 Performance and Flexibility
- **stdio Transport**: Low latency, direct LLM integration
- **Async Operations**: Non-blocking operations
- **Error Handling**: Graceful degradation
- **Fallback Mechanisms**: Uses grep if ripgrep unavailable
- **Auto-detection**: Automatically finds config sync directory

## 🚀 Quick Start

### Requirements

- Node.js 18+
- DDEV (local development environment)
- At least one Drupal project (managed by DDEV)

### 5-Minute Setup

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/drupal-mcp-server.git
cd drupal-mcp-server

# 2. Install dependencies
npm install

# 3. Build
npm run build

# 4. Create config files
cp config/config.yaml.example config/config.yaml
cp .env.example .env

# 5. Generate token (edit .env file)
echo "MCP_TOKEN=$(openssl rand -hex 32)" >> .env

# 6. Test
npm start
```

## 📦 Installation

### Install with NPM

```bash
npm install
npm run build
```

### Install with Yarn

```bash
yarn install
yarn build
```

### Development Mode

```bash
npm run dev
```

## ⚙️ Configuration

### Environment Variables (.env)

```env
# MCP Server Token (required)
MCP_TOKEN=your-secure-token-here

# Optional: Drupal root path override
# DRUPAL_ROOT=/path/to/drupal

# Optional: Config sync directory override
# CONFIG_SYNC_DIR=config/sync

# Optional: Drush path override
# DRUSH_PATH=/path/to/drush

# Log level (debug|info|warn|error)
LOG_LEVEL=info

# Audit log path
AUDIT_LOG_PATH=./logs/audit.log

# Rate limit (requests per minute)
RATE_LIMIT_RPM=60

# Max response size (bytes)
MAX_RESPONSE_SIZE=1048576

# Environment
ENVIRONMENT=production
```

### YAML Configuration (config/config.yaml)

```yaml
server:
  name: drupal-mcp
  version: 1.0.0
  transport: stdio

rbac:
  enabled: true
  roles:
    admin:
      permissions: ['*']
    developer:
      permissions:
        - read_only
        - code_read
        - config_read
        - schema_read
        - content_read
    viewer:
      permissions:
        - read_only

  tokens:
    ${MCP_TOKEN}: admin

sites:
  auto_discover: true
  manual_sites: []

security:
  redaction:
    enabled: true
    secret_patterns:
      - 'password'
      - 'api[_-]?key'
      - 'secret'
      - 'token'
      - 'private[_-]?key'
    pii_patterns:
      - '\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
      - '\b\d{3}[-.]?\d{3}[-.]?\d{4}\b'

  path_guard:
    enabled: true
    allowed_paths:
      - 'web/modules/custom/**'
      - 'web/themes/custom/**'
      - 'web/sites/**/settings*.php'
      - 'web/sites/**/files/config_*/**'
      - 'config/sync/**'
      - 'config/**'
      - 'composer.json'
      - 'composer.lock'
    denied_paths:
      - '**/.git/**'
      - '**/node_modules/**'
      - '**/vendor/**'
      - '**/.env'

  rate_limit:
    enabled: true
    requests_per_minute: 60

drush:
  safe_mode: true
  allowed_commands:
    - 'core:status'
    - 'pm:list'
    - 'config:get'
    - 'config:export'
    - 'entity:info'
    - 'views:list'
    - 'views:export'

audit:
  enabled: true
  log_path: ./logs/audit.log
```

## 🔧 MCP Tools

### 1. drupal_list_sites

Lists all discovered DDEV Drupal sites.

**Parameters:** None

**Example Response:**
```json
{
  "total": 3,
  "sites": [
    {
      "name": "site1",
      "path": "/path/to/drupal-site1",
      "type": "drupal10",
      "status": "running"
    }
  ]
}
```

### 2. drupal_refresh_sites

Re-discovers the site list.

**Parameters:** None

### 3. drupal_project_info

Retrieves Drupal project information.

**Parameters:**
- `site` (string, required): Site name

**Example Response:**
```json
{
  "site_name": "My Drupal Site",
  "drupal_version": "10.2.0",
  "php_version": "8.2.0",
  "database": "mysql",
  "enabled_modules_count": 89,
  "enabled_modules": ["node", "user", "system", "..."]
}
```

### 4. drupal_search_code

Searches in custom code (ripgrep or grep).

**Parameters:**
- `site` (string, required): Site name
- `query` (string, required): Search term
- `paths` (array, optional): Search paths (default: custom modules/themes)
- `max_results` (number, optional): Max results (default: 20)
- `regex` (boolean, optional): Use regex (default: false)

**Example Response:**
```json
{
  "query": "EntityInterface",
  "engine": "grep",
  "total_matches": 5,
  "results": [
    {
      "file": "web/modules/custom/my_module/src/Controller/MyController.php",
      "line": 12,
      "text": "use Drupal\\Core\\Entity\\EntityInterface;"
    }
  ]
}
```

### 5. drupal_read_file

Reads file content with PII/secret masking.

**Parameters:**
- `site` (string, required): Site name
- `path` (string, required): File path (relative to site root)
- `start_line` (number, optional): Start line
- `end_line` (number, optional): End line

### 6. drupal_list_custom_components

Lists custom modules and themes.

**Parameters:**
- `site` (string, required): Site name
- `type` (string, optional): "modules", "themes", or "all" (default: "all")

### 7. drupal_config_get

Reads Drupal configuration.

**Parameters:**
- `site` (string, required): Site name
- `keys_or_prefix` (string, required): Config key or prefix
- `source` (string, optional): "sync" or "db" (default: "sync")

### 8. drupal_db_schema

Inspects database schema.

**Parameters:**
- `site` (string, required): Site name
- `table` (string, optional): Table name (lists all if empty)

**Example Response:**
```json
{
  "table": "users_field_data",
  "columns": [
    {"name": "uid", "type": "int", "pii_risk": false},
    {"name": "name", "type": "varchar(60)", "pii_risk": true},
    {"name": "mail", "type": "varchar(254)", "pii_risk": true}
  ],
  "pii_columns": ["name", "mail"]
}
```

### 9. drupal_drush

Executes Drush commands (with safe mode).

**Parameters:**
- `site` (string, required): Site name
- `command` (string, required): Drush command
- `args` (array, optional): Command arguments
- `safe_mode` (boolean, optional): Allowlist check (default: true)

### 10. drupal_entity_schema_summary

Retrieves content model summary.

**Parameters:**
- `site` (string, required): Site name

### 11. drupal_view_export

Lists views or exports a specific view.

**Parameters:**
- `site` (string, required): Site name
- `name` (string, optional): View machine name (lists all if empty)

## 🔐 Security

### Token Authentication (Optional)

**Not required for local use.** Token is only needed for:
- Remote network access
- Multi-user scenarios
- Production deployments

For local use with Windsurf or Claude Desktop, you can disable token checking:

```yaml
# config.yaml
rbac:
  enabled: false  # Disable token authentication
```

### RBAC (Role-Based Access Control)

Tools are grouped by permissions:
- `read_only`: Site list, refresh
- `code_read`: Code search, file reading
- `config_read`: Config reading
- `schema_read`: DB schema reading
- `content_read`: Entity schema, views
- `drush_exec`: Drush commands

### PII/Secret Redaction

Automatically masks:
- Email addresses
- Phone numbers
- API keys, tokens, passwords
- Database credentials

### Path Guard

Protection against path traversal attacks:
- Allowed paths whitelist
- Denied paths blacklist
- Symlink checking

### Rate Limiting

Per-minute request limit (default: 60 req/min).

### Audit Logging

All tool calls are logged:
```json
{
  "timestamp": "2026-03-03T13:06:22.627Z",
  "tool": "drupal_list_sites",
  "params": {},
  "status": "success",
  "duration_ms": 2
}
```

## 🐳 Docker Usage

### Run with Docker Compose

```bash
docker compose up -d
```

### Docker Build

```bash
docker build -t drupal-mcp-server .
docker run -v /var/run/docker.sock:/var/run/docker.sock \
  -v ~/.ddev:/root/.ddev \
  -e MCP_TOKEN=your-token \
  drupal-mcp-server
```

## 📚 Examples

### Claude Desktop Integration

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "drupal": {
      "command": "node",
      "args": ["/path/to/drupal-mcp-server/dist/index.js"],
      "env": {
        "MCP_TOKEN": "your-secure-token"
      }
    }
  }
}
```

### Windsurf Integration

`~/.windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "drupal": {
      "command": "node",
      "args": ["/path/to/drupal-mcp-server/dist/index.js"],
      "env": {
        "MCP_TOKEN": "your-secure-token",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### Programmatic Usage

```typescript
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["/path/to/drupal-mcp-server/dist/index.js"],
  env: {
    MCP_TOKEN: "your-token"
  }
});

const client = new Client({
  name: "drupal-client",
  version: "1.0.0"
}, {
  capabilities: {}
});

await client.connect(transport);

// List sites
const sites = await client.callTool({
  name: "drupal_list_sites",
  arguments: {}
});

console.log(sites);
```

## 🔍 Troubleshooting

### Server won't start

```bash
# Set log level to debug
LOG_LEVEL=debug npm start

# Check audit log
tail -f logs/audit.log
```

### DDEV sites not found

```bash
# Check DDEV is running
ddev list

# Add site manually (config.yaml)
sites:
  manual_sites:
    - name: mysite
      path: /path/to/mysite
      type: drupal10
```

### Permission errors

```bash
# Check token is correct
echo $MCP_TOKEN

# Check RBAC configuration (config.yaml)
rbac:
  tokens:
    your-token-here: admin
```

### Drush commands not working

```bash
# Disable safe mode (use with caution!)
drush:
  safe_mode: false

# Or add to allowlist
drush:
  allowed_commands:
    - 'your:command'
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Use TypeScript strict mode
- Follow ESLint rules
- Write tests (coverage 80%+)
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages

### Running Tests

```bash
npm test
npm run test:coverage
```

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.