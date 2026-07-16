# Dev Env · 本地开发环境安装

基于 **Tauri 2 + React 19 + TypeScript** 的桌面开发环境管理工具，目标是提供类似 Laragon / ServBay 的本地环境体验：一键安装、启用、启动和管理 Nginx、PHP、MySQL、Redis、RabbitMQ、RocketMQ、Java、Node.js 等组件。

[![Release](https://img.shields.io/github/v/release/caojiabin2012/dev-env)](https://github.com/caojiabin2012/dev-env/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 当前状态

- 当前主界面已切换为 **StackPanel**，默认进入本地环境管理面板。
- 历史上的开发者工具模块仍保留在仓库中，但当前应用壳层没有接入这些页面。
- 发布流程已接入 GitHub Actions，tag `v*` 会自动构建 Windows / Linux / macOS 安装包并生成 `latest.json`。
- Windows 是当前优先验证平台，Linux / macOS 打包链路也已纳入同一套 Release Workflow。

详细开发文档见 [`doc/`](doc/) 目录。

## 功能概览

| 模块 | 说明 |
|------|------|
| 仪表盘 | 系统资源、组件状态、快捷入口 |
| 软件包管理 | 下载、安装、启用、卸载、启动/停止组件 |
| 站点管理 | 站点目录、域名、运行时、Web 服务器绑定 |
| 环境设置 | 安装目录、`www` 目录、开机自启、PATH、配置重建 |
| 数据库工具 | 数据库创建、导入、导出、表结构查看 |
| 运行时支持 | PHP、Java、Node.js、Python、Go、Composer、pip、npm |
| 中间件支持 | MySQL、MariaDB、Redis、RabbitMQ、RocketMQ |

## 技术栈

- **前端**：React 19 · TypeScript · Tailwind CSS v4 · Vite 8
- **桌面**：Tauri 2 · Rust
- **状态存储**：JSON 单文件为主，SQLite 仅用于剪切板历史等旧功能
- **更新**：`tauri-plugin-updater` + GitHub Releases + `latest.json`
- **发布**：GitHub Actions，多平台构建与 Release 自动发布

## 快速开始

### 环境要求

- Node.js 20+
- pnpm 9+
- Rust 1.77+
- [Tauri 前置依赖](https://v2.tauri.app/start/prerequisites/)

### 安装与开发

```bash
pnpm install
pnpm tauri dev
```

仅启动前端调试：

```bash
pnpm dev
```

> 浏览器访问 `localhost:5180` 时只会看到“请使用桌面应用启动”，因为真正的功能依赖 Tauri 后端命令。

### 构建安装包

```bash
pnpm build
pnpm tauri build
```

产物位于 `src-tauri/target/release/bundle/`：

- Windows：`msi/`、`nsis/`
- macOS：`dmg/`、`macos/*.tar.gz`
- Linux：`deb/`、`appimage/`

### 下载

前往 [Releases](https://github.com/caojiabin2012/dev-env/releases) 下载最新版安装包。

## 数据目录

应用数据保存在 `%LOCALAPPDATA%\dev-env\`：

- `settings.json`：应用设置
- `clipboard.db`：剪切板历史数据库
- `logs/`：滚动运行日志
- `crash.log`：崩溃与前端错误日志

## 发布流程

- 修改版本号：`package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`
- 编写发布说明：`release-notes/vX.Y.Z.md`
- 推送 `vX.Y.Z` tag
- GitHub Actions 执行 `.github/workflows/release.yml`

发布工作流会：

- 构建 Windows / Linux / macOS 安装包
- 上传 GitHub Release 附件
- 生成 `latest.json`
- 将更新说明写入 Release body

## 项目结构

```text
dev-env/
├── src/                  # React 前端
│   ├── components/       # 组件与页面
│   ├── lib/              # API、Hook、工具函数
│   └── App.tsx           # 当前主入口，默认渲染 StackPanel
├── src-tauri/            # Tauri Rust 后端
│   └── src/stack/        # 本地环境管理核心实现
├── doc/                  # 功能与实现文档
├── release-notes/        # 版本发布说明
└── .github/workflows/    # CI / Release
```

## 文档索引

- [项目概述](doc/00.overview.md)
- [设置](doc/04.settings.md)
- [主题](doc/05.theme.md)
- [关于与更新](doc/06.about.md)
- [发版流程](doc/13.release.md)

## 更新日志

见 [CHANGELOG.md](CHANGELOG.md)。

## 许可证

MIT License
