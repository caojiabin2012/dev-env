use std::fs;
use std::path::Path;

use crate::stack::store::{resolve_site_root, resolve_www_root};
use crate::stack::types::{StackStore, WebSite};

const TEST_PHP: &str = r#"<?php
header('Content-Type: text/html; charset=utf-8');
$config = require __DIR__ . '/devtools-env.php';

$mysqlOk = false;
$mysqlRows = [];
$redisOk = false;
$redisInfo = [];
$errors = [];

// --- MySQL（PDO）---
try {
    if (!extension_loaded('pdo_mysql')) {
        throw new RuntimeException('pdo_mysql 扩展未启用');
    }
    $m = $config['mysql'];
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $m['host'],
        $m['port'],
        $m['database']
    );
    $pdo = new PDO($dsn, $m['user'], $m['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $version = $pdo->query('SELECT VERSION() AS v')->fetch();
    $mysqlRows = $pdo->query('SELECT id, name, email, created_at FROM demo_users ORDER BY id')->fetchAll();
    $mysqlOk = true;
    $mysqlInfo = [
        'driver' => 'PDO (pdo_mysql)',
        'dsn' => $dsn,
        'user' => $m['user'],
        'version' => $version['v'] ?? '',
        'rows' => count($mysqlRows),
    ];
} catch (Throwable $e) {
    $errors[] = 'MySQL: ' . $e->getMessage();
    $mysqlInfo = ['connected' => false];
}

// --- Redis ---
try {
    if (!extension_loaded('redis')) {
        throw new RuntimeException('redis 扩展未启用');
    }
    $r = $config['redis'];
    $redis = new Redis();
    if (!$redis->connect($r['host'], (int) $r['port'], 2.0)) {
        throw new RuntimeException('Redis 连接失败');
    }
    $redis->set('devtools:test', 'hello from dev-tools');
    $redisInfo = [
        'driver' => 'phpredis',
        'host' => $r['host'],
        'port' => $r['port'],
        'ping' => $redis->ping(),
        'devtools:test' => $redis->get('devtools:test'),
    ];
    $redisOk = true;
} catch (Throwable $e) {
    $errors[] = 'Redis: ' . $e->getMessage();
}

?><!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>dev-tools 环境联调测试</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 880px; margin: 32px auto; padding: 0 16px; color: #18181b; }
    h1 { font-size: 1.35rem; }
    .summary { display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0; }
    .pill { padding: 8px 14px; border-radius: 999px; font-size: 13px; border: 1px solid #e4e4e7; }
    .pill.ok { background: #ecfdf5; color: #059669; border-color: #a7f3d0; }
    .pill.fail { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
    section { margin: 24px 0; padding: 16px; border: 1px solid #e4e4e7; border-radius: 12px; background: #fafafa; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { border: 1px solid #e4e4e7; padding: 8px 10px; text-align: left; }
    th { background: #f4f4f5; }
    .err { color: #dc2626; background: #fef2f2; padding: 12px; border-radius: 8px; margin: 8px 0; }
    code { background: #f4f4f5; padding: 2px 6px; border-radius: 4px; }
    pre { background: #18181b; color: #fafafa; padding: 12px; border-radius: 8px; overflow: auto; font-size: 13px; }
  </style>
</head>
<body>
  <h1>dev-tools 环境联调测试</h1>
  <p>MySQL 使用 <code>PDO</code> 连接；Redis 使用 <code>phpredis</code> 扩展。</p>

  <div class="summary">
    <span class="pill <?= $mysqlOk ? 'ok' : 'fail' ?>">MySQL <?= $mysqlOk ? '已连接' : '未连接' ?></span>
    <span class="pill <?= $redisOk ? 'ok' : 'fail' ?>">Redis <?= $redisOk ? '已连接' : '未连接' ?></span>
  </div>

  <?php if ($errors): ?>
    <?php foreach ($errors as $err): ?>
      <div class="err"><?= htmlspecialchars($err) ?></div>
    <?php endforeach; ?>
  <?php endif; ?>

  <section>
    <h2>MySQL · test.demo_users</h2>
    <?php if ($mysqlOk): ?>
      <pre><?= htmlspecialchars(json_encode($mysqlInfo, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) ?></pre>
      <table>
        <thead><tr><th>ID</th><th>姓名</th><th>邮箱</th><th>创建时间</th></tr></thead>
        <tbody>
        <?php foreach ($mysqlRows as $row): ?>
          <tr>
            <td><?= (int)$row['id'] ?></td>
            <td><?= htmlspecialchars($row['name']) ?></td>
            <td><?= htmlspecialchars($row['email']) ?></td>
            <td><?= htmlspecialchars($row['created_at']) ?></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table>
    <?php else: ?>
      <p>请确认 MariaDB 已启动，且 test 库 / demo_users 表已初始化（启动 MySQL 时会自动创建）。</p>
    <?php endif; ?>
  </section>

  <section>
    <h2>Redis</h2>
    <?php if ($redisOk): ?>
      <pre><?= htmlspecialchars(json_encode($redisInfo, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) ?></pre>
    <?php else: ?>
      <p>请确认 Redis 已启动（默认 127.0.0.1:6379）。</p>
    <?php endif; ?>
  </section>

  <p><a href="index.php">← 返回首页</a></p>
</body>
</html>
"#;

/// 写入网站根目录下的 devtools-env.php、test.php，并确保 index 页面存在。
pub fn sync_site_files(store: &StackStore, install_root: &Path) -> Result<(), String> {
    if store.sites.is_empty() {
        let www = resolve_www_root(install_root, &store.settings);
        fs::create_dir_all(&www).map_err(|e| e.to_string())?;
        write_site_files(&www, store)?;
        ensure_index_files(&www)?;
        return Ok(());
    }

    for site in &store.sites {
        let www = resolve_site_root(install_root, &site.root);
        fs::create_dir_all(&www).map_err(|e| e.to_string())?;
        write_site_files(&www, store)?;
        ensure_site_scaffold(&www, site)?;
    }
    Ok(())
}

pub fn ensure_site_scaffold(www: &Path, site: &WebSite) -> Result<(), String> {
    match site.runtime.as_str() {
        "php" => ensure_php_scaffold(www),
        "static" => ensure_static_scaffold(www),
        "python" | "go" | "node" => ensure_runtime_scaffold(www, site),
        _ => ensure_static_scaffold(www),
    }
}

fn ensure_php_scaffold(www: &Path) -> Result<(), String> {
    ensure_index_files(www)
}

fn ensure_static_scaffold(www: &Path) -> Result<(), String> {
    fs::write(
        www.join("index.html"),
        r#"<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>dev-tools 站点</title></head>
<body>
<h1>dev-tools 静态站点</h1>
<p>将 HTML / CSS / JS 文件放在此目录即可。</p>
</body>
</html>
"#,
    )
    .map_err(|e| e.to_string())
}

fn ensure_runtime_scaffold(www: &Path, site: &WebSite) -> Result<(), String> {
    let lang = site.runtime.as_str();
    let version = site
        .runtime_version_id
        .as_deref()
        .unwrap_or("latest");
    let title = crate::stack::site_runtime::runtime_display(lang, Some(version));

    match lang {
        "go" => ensure_go_scaffold(www, site),
        "python" => ensure_python_scaffold(www, site),
        "node" | _ => {
            fs::write(
                www.join("index.html"),
                format!(
                    r#"<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>{title}</title></head>
<body>
<h1>{title}</h1>
<p>此站点绑定运行时 <strong>{lang}</strong>（版本 {version}）。</p>
<p>请在 Packages 中安装并启动对应版本；Web 服务（Nginx 等）负责静态文件，运行时联调能力将逐步接入。</p>
</body>
</html>
"#
                ),
            )
            .map_err(|e| e.to_string())?;
            Ok(())
        }
    }
}

const GO_MAIN_TEMPLATE: &str = "package main\n\nimport (\n\t\"fmt\"\n\t\"log\"\n\t\"net/http\"\n\t\"os\"\n)\n\nfunc main() {\n\tport := os.Getenv(\"PORT\")\n\tif port == \"\" {\n\t\tport = \"{{PORT}}\"\n\t}\n\n\tmux := http.NewServeMux()\n\n\tmux.HandleFunc(\"/\", func(w http.ResponseWriter, r *http.Request) {\n\t\tw.Header().Set(\"Content-Type\", \"text/html; charset=utf-8\")\n\t\tfmt.Fprintf(w, \"<!DOCTYPE html>\\n<html lang=\\\"zh-CN\\\">\\n<head><meta charset=\\\"utf-8\\\"><title>{{TITLE}}</title>\\n<style>\\n  body { font-family: system-ui, sans-serif; max-width: 720px; margin: 48px auto; padding: 0 16px; color: #222; }\\n  h1 { font-size: 1.5rem; }\\n  code { background: #f4f4f5; padding: 2px 6px; border-radius: 4px; }\\n  .info { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0; }\\n</style></head>\\n<body>\\n<h1>{{TITLE}}</h1>\\n<div class=\\\"info\\\">\\n  <p>Go HTTP 服务运行中 ✅</p>\\n  <p>监听端口：<code>%s</code></p>\\n  <p>站点目录：<code>{{ROOT}}</code></p>\\n</div>\\n<p>将 <code>main.go</code> 替换为你的 Go 应用代码，保存后重启站点即可生效。</p>\\n</body>\\n</html>\", port)\n\t})\n\n\tlog.Printf(\"站点 {{SITE_NAME}} 启动在 http://127.0.0.1:%s\", port)\n\tif err := http.ListenAndServe(\"127.0.0.1:\"+port, mux); err != nil {\n\t\tlog.Fatalf(\"服务启动失败: %v\", err)\n\t}\n}\n";

const GO_MOD_TEMPLATE: &str = "module {{MODULE}}\n\ngo {{GO_VERSION}}\n";

fn ensure_go_scaffold(www: &Path, site: &WebSite) -> Result<(), String> {
    let port = site.port.map(|p| p.to_string()).unwrap_or_else(|| "8100".to_string());
    let version = site
        .runtime_version_id
        .as_deref()
        .unwrap_or("1.21.0");
    // Extract major.minor from go version like "1.26.4" → "1.26"
    let go_mod_version = extract_go_mod_version(version);
    let module_name = format!("dev-tools/{}", site.id);
    let title = crate::stack::site_runtime::runtime_display("go", Some(version));
    let root_display = www.to_string_lossy().replace('\\', "/");

    let main_go_path = www.join("main.go");
    let go_mod_path = www.join("go.mod");

    // 仅在文件不存在时写入（保护用户已修改的代码）
    if !main_go_path.exists() {
        let main_go = GO_MAIN_TEMPLATE
            .replace("{{PORT}}", &port)
            .replace("{{TITLE}}", &title)
            .replace("{{ROOT}}", &root_display)
            .replace("{{SITE_NAME}}", &site.name);
        fs::write(&main_go_path, main_go).map_err(|e| e.to_string())?;
    }
    if !go_mod_path.exists() {
        let go_mod = GO_MOD_TEMPLATE
            .replace("{{MODULE}}", &module_name)
            .replace("{{GO_VERSION}}", &go_mod_version);
        fs::write(&go_mod_path, go_mod).map_err(|e| e.to_string())?;
    }

    // Also write a simple index.html for when Go process is not running (only if not exists)
    let index_html_path = www.join("index.html");
    if !index_html_path.exists() {
        fs::write(
            &index_html_path,
        format!(
            r#"<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>{title}</title>
<style>
  body {{ font-family: system-ui, sans-serif; max-width: 720px; margin: 48px auto; padding: 0 16px; color: #222; }}
  code {{ background: #f4f4f5; padding: 2px 6px; border-radius: 4px; }}
</style></head>
<body>
<h1>{title}</h1>
<p>Go 站点已就绪。请启动站点进程后刷新页面。</p>
<p>站点端口：<code>{port}</code></p>
<p>启动命令：<code>go run main.go</code> 或点击界面上的启动按钮。</p>
</body>
</html>
"#,
        ),
    ).map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// 从 "1.26.4" 提取 "1.26"
fn extract_go_mod_version(version: &str) -> String {
    let parts: Vec<&str> = version.split('.').collect();
    if parts.len() >= 2 {
        format!("{}.{}", parts[0], parts[1])
    } else {
        "1.21".to_string()
    }
}

const PYTHON_SERVER_TEMPLATE: &str = r#"import os
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = int(os.environ.get("PORT", "{{PORT}}"))
SITE_NAME = "{{SITE_NAME}}"
ROOT = os.path.dirname(__file__)

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = os.path.join(ROOT, self.path.lstrip("/"))
        # 如果请求的是静态文件且存在，直接返回
        if os.path.isfile(path) and not self.path.endswith("/"):
            self._serve_file(path)
            return
        # 目录或根路径 → 返回状态页
        self._serve_status()

    def _serve_status(self):
        body = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>{SITE_NAME}</title>
<style>
  body {{ font-family: system-ui, sans-serif; max-width: 720px; margin: 48px auto; padding: 0 16px; color: #222; }}
  h1 {{ font-size: 1.5rem; }}
  code {{ background: #f4f4f5; padding: 2px 6px; border-radius: 4px; }}
  .info {{ background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0; }}
  .file-list {{ color: #666; font-size: 13px; }}
  .file-list a {{ color: #2563eb; text-decoration: none; }}
  .file-list a:hover {{ text-decoration: underline; }}
</style></head>
<body>
<h1>{SITE_NAME}</h1>
<div class="info">
  <p>Python HTTP 服务运行中 ✅</p>
  <p>监听端口：<code>{PORT}</code></p>
  <p>站点目录：<code>{ROOT}</code></p>
</div>
<p>将 <code>server.py</code> 替换为你的 Python 应用代码，保存后重启站点即可生效。</p>
<details class="file-list">
  <summary>目录文件</summary>
  <ul style="margin-top:4px">"""
        for name in sorted(os.listdir(ROOT)):
            if name.startswith("."):
                continue
            body += f"<li><a href=\"/{name}\">{name}</a></li>"
        body += "</ul></details></body></html>"
        self._reply(200, body, "text/html; charset=utf-8")

    def _serve_file(self, path):
        try:
            with open(path, "rb") as f:
                data = f.read()
            ct = "text/html; charset=utf-8" if path.endswith(".html") else "application/octet-stream"
            self._reply(200, data, ct)
        except Exception:
            self._reply(404, "Not Found", "text/plain")

    def _reply(self, code, body, content_type):
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print(f"[Python] {self.client_address[0]} - {fmt % args}")

httpd = HTTPServer(("127.0.0.1", PORT), Handler)
print(f"站点 {SITE_NAME} 启动在 http://127.0.0.1:{PORT}")
sys.stdout.flush()
httpd.serve_forever()
"#;

fn ensure_python_scaffold(www: &Path, site: &WebSite) -> Result<(), String> {
    let port = site.port.map(|p| p.to_string()).unwrap_or_else(|| "8100".to_string());
    let version = site
        .runtime_version_id
        .as_deref()
        .unwrap_or("3.x");
    let title = crate::stack::site_runtime::runtime_display("python", Some(version));

    let server_py_path = www.join("server.py");
    // 仅在文件不存在时写入（保护用户已修改的代码）
    if !server_py_path.exists() {
        let server_py = PYTHON_SERVER_TEMPLATE
            .replace("{{PORT}}", &port)
            .replace("{{SITE_NAME}}", &site.name);
        fs::write(&server_py_path, server_py).map_err(|e| e.to_string())?;
    }

    let index_html_path = www.join("index.html");
    if !index_html_path.exists() {
        fs::write(
            &index_html_path,
            format!(
                r#"<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>{title}</title>
<style>
  body {{ font-family: system-ui, sans-serif; max-width: 720px; margin: 48px auto; padding: 0 16px; color: #222; }}
  code {{ background: #f4f4f5; padding: 2px 6px; border-radius: 4px; }}
</style></head>
<body>
<h1>{title}</h1>
<p>Python 站点已就绪。请启动站点进程后刷新页面。</p>
<p>站点端口：<code>{port}</code></p>
<p>启动命令：<code>python server.py</code> 或点击界面上的启动按钮。</p>
</body>
</html>
"#,
            ),
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn write_site_files(www: &Path, store: &StackStore) -> Result<(), String> {
    let mysql_port = store
        .mysql
        .as_ref()
        .map(|m| m.port)
        .or_else(|| store.mariadb.as_ref().map(|m| m.port))
        .unwrap_or(3307);
    let redis_port = store.redis.as_ref().map(|r| r.port).unwrap_or(6379);

    let env_php = format!(
        r#"<?php
return [
    'mysql' => [
        'host' => '127.0.0.1',
        'port' => {mysql_port},
        'user' => 'root',
        'password' => '',
        'database' => 'test',
    ],
    'redis' => [
        'host' => '127.0.0.1',
        'port' => {redis_port},
    ],
];
"#
    );

    fs::write(www.join("devtools-env.php"), env_php).map_err(|e| e.to_string())?;
    fs::write(www.join("test.php"), TEST_PHP).map_err(|e| e.to_string())?;
    Ok(())
}

fn ensure_index_files(www: &Path) -> Result<(), String> {
    fs::write(
        &www.join("index.php"),
        r#"<?php
header('Content-Type: text/html; charset=utf-8');
echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>dev-tools 本地环境</title>';
echo '<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:48px auto;padding:0 16px;color:#222}';
echo 'code{background:#f4f4f5;padding:2px 6px;border-radius:4px}a{color:#2563eb}</style></head><body>';
echo '<h1>dev-tools 本地环境</h1>';
echo '<p>Nginx + PHP 运行正常。网站根目录：<code>' . htmlspecialchars(__DIR__) . '</code></p>';
echo '<p><a href="test.php"><strong>MySQL + Redis 联调测试</strong></a></p>';
echo '<p><a href="index.php?phpinfo=1">查看 PHP 信息</a></p>';
if (isset($_GET['phpinfo'])) { echo '<hr><h2>PHP 信息</h2>'; phpinfo(); }
"#,
    )
    .map_err(|e| e.to_string())?;

    fs::write(
        &www.join("index.html"),
        r#"<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8"><title>dev-tools 本地环境</title></head>
<body>
<h1>dev-tools 本地环境</h1>
<p><a href="test.php">MySQL + Redis 联调测试</a> · <a href="index.php">PHP 首页</a></p>
</body>
</html>
"#,
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
