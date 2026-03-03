# Drupal MCP Server

DDEV üzerinden çalışan çoklu Drupal projelerinizi LLM'lere (Claude, ChatGPT, vb.) güvenli şekilde açan **Model Context Protocol (MCP) Server**.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

[English](README.md) | **Türkçe**

## 📋 İçindekiler

- [Özellikler](#-özellikler)
- [Hızlı Başlangıç](#-hızlı-başlangıç)
- [Kurulum](#-kurulum)
- [Konfigürasyon](#-konfigürasyon)
- [MCP Tools](#-mcp-tools)
- [Güvenlik](#-güvenlik)
- [Docker Kullanımı](#-docker-kullanımı)
- [Örnekler](#-örnekler)
- [Sorun Giderme](#-sorun-giderme)
- [Katkıda Bulunma](#-katkıda-bulunma)
- [Lisans](#-lisans)

## ✨ Özellikler

### 🎯 Çoklu Site Desteği
- **Otomatik Keşif**: `ddev list` ile tüm DDEV projelerinizi otomatik bulur
- **Manuel Konfigürasyon**: İstediğiniz siteleri manuel olarak ekleyebilirsiniz
- **Site Filtreleme**: Sadece Drupal projelerini listeler (Drupal 8/9/10/11)
- **Durum Takibi**: Running/stopped durumlarını gösterir

### 🛠️ 11 Güçlü MCP Tool
1. **drupal_list_sites** - Keşfedilen DDEV sitelerini listele
2. **drupal_refresh_sites** - Site listesini yeniden keşfet
3. **drupal_project_info** - Drupal versiyon, modüller, environment bilgisi
4. **drupal_search_code** - Custom kod içinde arama (ripgrep/grep)
5. **drupal_read_file** - Dosya okuma (PII/secret maskeleme ile)
6. **drupal_list_custom_components** - Custom modül ve theme listesi
7. **drupal_config_get** - Config okuma (sync dizini veya database)
8. **drupal_db_schema** - Database şema introspection (PII tagging)
9. **drupal_drush** - Drush komutları (güvenli allowlist ile)
10. **drupal_entity_schema_summary** - Content model özeti
11. **drupal_view_export** - Views listesi ve export

### 🔒 Kapsamlı Güvenlik
- **Token Authentication**: Bearer token ile API güvenliği
- **RBAC (Role-Based Access Control)**: Tool bazlı yetkilendirme
- **PII/Secret Redaction**: Otomatik hassas veri maskeleme
- **Path Guard**: Path traversal koruması
- **Rate Limiting**: Dakika bazlı istek sınırlama
- **Audit Logging**: Tüm işlemlerin detaylı loglanması
- **Safe Mode**: Drush komutları için allowlist

### 🚀 Performans ve Esneklik
- **stdio Transport**: Düşük latency, doğrudan LLM entegrasyonu
- **Async Operations**: Non-blocking işlemler
- **Error Handling**: Graceful degradation
- **Fallback Mechanisms**: ripgrep yoksa grep kullanımı
- **Auto-detection**: Config sync dizini otomatik bulma

## 🚀 Hızlı Başlangıç

### Gereksinimler

- Node.js 18+
- DDEV (local development environment)
- En az bir Drupal projesi (DDEV ile yönetilen)

### 5 Dakikada Kurulum

```bash
# 1. Klonla ve kur
git clone https://github.com/oguzhanfiliz/drupal-mcp.git
cd drupal-mcp
npm install
npm run build

# 2. Başlat (DDEV sitelerini otomatik bulur)
npm start
```

Bu kadar! Server DDEV sitelerinizi otomatik keşfeder ve güvenli varsayılan ayarları kullanır.

## 📦 Kurulum

```bash
git clone https://github.com/oguzhanfiliz/drupal-mcp.git
cd drupal-mcp
npm install
npm run build
```

**Development Mode:**
```bash
npm run dev
```

## ⚙️ Konfigürasyon

### Environment Variables (.env)

**Opsiyonel** - Sadece özel konfigürasyon için gerekli:

```env
# MCP Server Token (opsiyonel - ayarlanmazsa otomatik oluşturulur)
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

### YAML Konfigürasyonu (config/config.yaml)

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

Keşfedilen tüm DDEV Drupal sitelerini listeler.

**Parametreler:** Yok

**Örnek Response:**
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

Site listesini yeniden keşfeder.

**Parametreler:** Yok

### 3. drupal_project_info

Drupal proje bilgilerini getirir.

**Parametreler:**
- `site` (string, zorunlu): Site adı

**Örnek Response:**
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

Custom kod içinde arama yapar (ripgrep veya grep).

**Parametreler:**
- `site` (string, zorunlu): Site adı
- `query` (string, zorunlu): Arama terimi
- `paths` (array, opsiyonel): Arama yolları (default: custom modules/themes)
- `max_results` (number, opsiyonel): Max sonuç sayısı (default: 20)
- `regex` (boolean, opsiyonel): Regex kullan (default: false)

**Örnek Response:**
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

Dosya içeriğini okur (PII/secret maskeleme ile).

**Parametreler:**
- `site` (string, zorunlu): Site adı
- `path` (string, zorunlu): Dosya yolu (site root'a göre)
- `start_line` (number, opsiyonel): Başlangıç satırı
- `end_line` (number, opsiyonel): Bitiş satırı

### 6. drupal_list_custom_components

Custom modül ve theme'leri listeler.

**Parametreler:**
- `site` (string, zorunlu): Site adı
- `type` (string, opsiyonel): "modules", "themes", veya "all" (default: "all")

### 7. drupal_config_get

Drupal konfigürasyonunu okur.

**Parametreler:**
- `site` (string, zorunlu): Site adı
- `keys_or_prefix` (string, zorunlu): Config key veya prefix
- `source` (string, opsiyonel): "sync" veya "db" (default: "sync")

### 8. drupal_db_schema

Database şemasını inceler.

**Parametreler:**
- `site` (string, zorunlu): Site adı
- `table` (string, opsiyonel): Tablo adı (boşsa tüm tabloları listeler)

**Örnek Response:**
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

Drush komutlarını çalıştırır (safe mode ile).

**Parametreler:**
- `site` (string, zorunlu): Site adı
- `command` (string, zorunlu): Drush komutu
- `args` (array, opsiyonel): Komut argümanları
- `safe_mode` (boolean, opsiyonel): Allowlist kontrolü (default: true)

### 10. drupal_entity_schema_summary

Content model özetini getirir.

**Parametreler:**
- `site` (string, zorunlu): Site adı

### 11. drupal_view_export

Views listesini veya belirli bir view'ı export eder.

**Parametreler:**
- `site` (string, zorunlu): Site adı
- `name` (string, opsiyonel): View machine name (boşsa tüm view'ları listeler)

## 🔐 Güvenlik

### Token Authentication

Her MCP request'inde `MCP_TOKEN` environment variable'ı kontrol edilir.

### RBAC (Role-Based Access Control)

Tool'lar permission'lara göre gruplandırılmıştır:
- `read_only`: Site listesi, refresh
- `code_read`: Kod arama, dosya okuma
- `config_read`: Config okuma
- `schema_read`: DB şema okuma
- `content_read`: Entity schema, views
- `drush_exec`: Drush komutları

### PII/Secret Redaction

Otomatik olarak şu bilgiler maskelenir:
- Email adresleri
- Telefon numaraları
- API keys, tokens, passwords
- Database credentials

### Path Guard

Path traversal saldırılarına karşı koruma:
- Allowed paths whitelist
- Denied paths blacklist
- Symlink kontrolü

### Rate Limiting

Dakika bazlı request limiti (default: 60 req/min).

### Audit Logging

Tüm tool çağrıları loglanır:
```json
{
  "timestamp": "2026-03-03T13:06:22.627Z",
  "tool": "drupal_list_sites",
  "params": {},
  "status": "success",
  "duration_ms": 2
}
```

## 🐳 Docker Kullanımı

### Docker Compose ile Çalıştırma

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

## 📚 Örnekler

### Claude Desktop Entegrasyonu

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

### Windsurf Entegrasyonu

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

### Programmatic Kullanım

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

## 🔍 Sorun Giderme

### Server başlamıyor

```bash
# Log seviyesini debug'a çek
LOG_LEVEL=debug npm start

# Audit log'u kontrol et
tail -f logs/audit.log
```

### DDEV siteleri bulunamıyor

```bash
# DDEV'in çalıştığını kontrol et
ddev list

# Manuel site ekle (config.yaml)
sites:
  manual_sites:
    - name: mysite
      path: /path/to/mysite
      type: drupal10
```

### Permission hataları

```bash
# Token'ın doğru olduğunu kontrol et
echo $MCP_TOKEN

# RBAC konfigürasyonunu kontrol et (config.yaml)
rbac:
  tokens:
    your-token-here: admin
```

### Drush komutları çalışmıyor

```bash
# Safe mode'u kapat (dikkatli kullanın!)
drush:
  safe_mode: false

# Veya allowlist'e ekle
drush:
  allowed_commands:
    - 'your:command'
```

## 🤝 Katkıda Bulunma

Katkılarınızı bekliyoruz! Lütfen şu adımları takip edin:

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'feat: Add amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

### Development Guidelines

- TypeScript strict mode kullanın
- ESLint kurallarına uyun
- Test yazın (coverage %80+)
- Commit mesajları için [Conventional Commits](https://www.conventionalcommits.org/) kullanın

### Test Çalıştırma

```bash
npm test
npm run test:coverage
```

## 📄 Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 🙏 Teşekkürler

- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP spesifikasyonu
- [DDEV](https://ddev.com/) - Local development environment
- [Drupal](https://www.drupal.org/) - Content management system

## 📞 İletişim

- Issues: [GitHub Issues](https://github.com/oguzhanfiliz/drupal-mcp/issues)
- Discussions: [GitHub Discussions](https://github.com/oguzhanfiliz/drupal-mcp/discussions)

---

**Made with ❤️ for the Drupal community**
