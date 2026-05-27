<div align="center">

# ImageManager

**🇨🇳 中文** · [🇬🇧 English](./README.en.md)

OpenAI 兼容图像 API 桌面客户端 · 编辑工坊风格 · Tauri 2 + React 19

</div>

---

## 简介

ImageManager 是一个面向**自部署 / 兼容 OpenAI 图像 API**（`gpt-image-2`、`gpt-image-1.5`、`gpt-image-1` 等）的桌面客户端。它不绑定 OpenAI 官方端点——任意符合 `/v1/images/generations` 与 `/v1/images/edits` 协议的网关都能直接接入。

设计上参考了"编辑工坊（atelier）"美学：暖纸基底、铜锈色强调、衬线大字配 mono 元信息——但所有装饰都让位于可读性与可访问性（WCAG AA 起步，部分 AAA）。

## 特性

- 🎨 **文生图 / 图生图（含 Mask）** — 完整覆盖 `/images/generations` 与 `/images/edits`
- 🔄 **流式预览** — 实时显示 `partial_image` 中间过程（最多 3 张过渡）
- 📐 **gpt-image-2 完整尺寸支持** — 最高 3840×2160（4K），自动按 16 对齐，遵循 1:3–3:1 比例约束
- 💾 **绿色版**（Windows）— 配置文件就在 exe 旁边，可整个目录拷走带走
- 🌍 **完整 i18n** — 简体中文 / English，自动跟随系统
- 🎚️ **浅 / 深 / 跟随系统三主题** — 实时切换、暖色系一致
- ⚡ **键盘优先** — `Ctrl 1-4` 导航 / `Ctrl + Enter` 提交 / `Ctrl ,` 设置
- 📱 **响应式 720 → 4K** — sidebar 自动折叠 / 字体阶梯缩放 / 内容流式回流
- 🔒 **本地配置**，不向第三方服务发任何遥测

## 截图

> 待补充。可参考 `docs/screenshots/` 目录。

## 下载

到 [Releases 页面](../../releases) 选择对应平台：

| 平台 | 文件 | 安装方式 |
|------|------|---------|
| **Windows** (x64) | `ImageManager_x.y.z_x64_en-US.msi` | 双击安装 |
| **Windows 绿色版** | `ImageManager.exe`（解压即用） | 解压到任意目录，双击启动 |
| **macOS** (Universal) | `ImageManager_x.y.z_universal.dmg` | 拖入 Applications |
| **Linux** | `.AppImage` / `.deb` | 见下方备注 |

### Linux 备注

- AppImage：`chmod +x ImageManager_*.AppImage && ./ImageManager_*.AppImage`
- deb：`sudo dpkg -i ImageManager_*.deb`
- 需要系统已安装 `libwebkit2gtk-4.1`

## 首次使用

1. 启动应用 → 默认进入 **首页**（Hi. I'm ImageManager.）
2. 进 **设置**（`Ctrl 4`）→ 填入：
   - `base_url`（默认 `https://api.openai.com/v1`，或换成你的兼容代理）
   - `api_key`（`sk-...`）
3. 回到 **文生图**（`Ctrl 2`），输入 prompt → `Ctrl Enter` 提交

## 配置文件位置

| 平台 | 路径 |
|------|------|
| **Windows** | `<exe 同目录>\config.json` 🍃 绿色模式 |
| **macOS** | `~/Library/Application Support/com.imagemanager.app/config.json` |
| **Linux** | `~/.config/com.imagemanager.app/config.json` |

> 改了配置后**自动持久化**——`Switch` / `Select` / `NumberInput` 即时写盘；文本输入框（base_url / api_key 等）在 blur（失焦）时写盘。

设置页底部有「用默认程序打开」与「在资源管理器中显示」两个按钮，可以直接定位文件。

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl 1` | 首页 |
| `Ctrl 2` | 文生图 |
| `Ctrl 3` | 图像编辑 |
| `Ctrl 4` / `Ctrl ,` | 设置 |
| `Ctrl + Enter` | 提交当前页面的生成 / 编辑 |
| `Esc` | 关闭下拉 / 组合框 |
| `↑ / ↓ / Enter / Esc` | 在 Combobox 内导航 |

macOS 上 `Ctrl` 也接受 `Cmd`，所以是 `⌘ 1` / `⌘ + Enter` 等。

## 模型支持

由 `gpt-image-2` 系列原生支持，但不限制 base_url——只要兼容 OpenAI 图像 API 协议都可用：

- `gpt-image-2`（默认，最高 4K，自动高保真）
- `gpt-image-1.5` / `gpt-image-1` / `gpt-image-1-mini`
- `dall-e-2` / `dall-e-3`（旧模型，2026-05-12 已下线，仅供兼容）

### gpt-image-2 尺寸约束

- 两边都必须能被 **16 整除**
- 长宽比在 **1:3 到 3:1** 之间
- 最大单边 **3840 px**
- 总像素在 655,360 ~ 8,294,400 之间
- 超过 2560×1440 的分辨率上游标记为 "experimental"（仍可用）

应用自动按这些规则计算 / 圆整，UI 上会实时显示真实将发送的尺寸。

## 开发

### 环境

- [Bun](https://bun.sh/) ≥ 1.0
- [Rust](https://rustup.rs/) stable
- 平台依赖：
  - Windows：MSVC build tools
  - macOS：Xcode Command Line Tools
  - Linux：`libwebkit2gtk-4.1-dev` `librsvg2-dev` `libayatana-appindicator3-dev` `patchelf`

### 命令

```bash
bun install            # 装前端依赖
bun run tauri dev      # 启动 dev（HMR + Rust shell）
bun run tauri build    # 编译产物到 src-tauri/target/release/
```

### 项目结构

```
src/
  components/     UI 组件 (Shell / TitleBar / Page / SizeSelector / ResultsView / ui/*)
  pages/          路由页面 (HomePage / GeneratePage / EditPage / SettingsPage)
  services/       业务逻辑 (apiClient / config / sizeCalc / store)
  styles/         全局 CSS / Tailwind v4 主题
  i18n/           zh.ts / en.ts / 初始化逻辑
src-tauri/
  capabilities/   Tauri 权限
  src/            Rust 端入口（基本空，前端为主）
  tauri.conf.json 窗口 / bundle / 标识符
.github/
  workflows/
    release.yml   跨平台编译 + 自动 release
```

### 技术栈

- **Tauri 2** — Rust shell + WebView 前端壳
- **React 19** + **TypeScript** + **Vite 7**
- **Tailwind CSS v4** + 自研编辑工坊设计系统
- **Radix UI** — Select / Switch / Toast / Label 等无样式原语
- **lucide-react** — 图标
- **zustand** — 状态管理
- **i18next** + **react-i18next**
- **Fraunces / Figtree / JetBrains Mono**（fontsource-variable）

## 发布流程

版本号**单一来源**：只改 `package.json` 的 `version`。`src-tauri/tauri.conf.json` 通过 `"version": "../package.json"` 自动读取它；`Cargo.toml` 仅作为 cargo metadata 存在，不影响打包出来的应用版本。

```bash
# 1. 改 package.json 的 version 字段（手动 / 用 bun pm 版本工具）
# 2. 提交
git add package.json && git commit -m "chore: bump version to 0.1.1"

# 3. 打 tag + push
git tag v0.1.1
git push origin main v0.1.1
```

push tag 触发 [`release.yml`](.github/workflows/release.yml)，并行编译 Windows / macOS / Linux 产物上传到 **Draft Release**——人工审阅后点 Publish 即正式发布。

也可以在 Actions 页用 `workflow_dispatch` 手动触发（指定任意 tag 名，不会创建本地 git tag）。

## 已知限制

- **Linux Wayland 上的窗口拖动**：某些 Wayland 合成器对 `tauri-drag-region` 支持有差异，可能需要点击应用图标拖动。
- 启动后若 `api_key` 未填，状态栏底部会显示橙色警告点 + 提示文案。

## 平台差异

| 平台 | 标题栏 | 窗口控制 |
|------|--------|---------|
| **macOS** | 原生 traffic-light（透明覆盖式），无标题文字 | 系统红黄绿三按钮在左 |
| **Windows / Linux** | 自定义编辑工坊标题栏（"●  IMAGEMANAGER · Atelier"） | 自定义 `_  □  ×` 在右 |

## License

MIT — 自由使用，欢迎 PR。

## 鸣谢

- [OpenAI](https://openai.com/) — 图像生成 API
- [Tauri](https://tauri.app/) — 轻量级桌面应用框架
- [Radix UI](https://www.radix-ui.com/) — 无障碍组件原语
- [Lucide](https://lucide.dev/) — 图标
- 字体：[Fraunces](https://fonts.google.com/specimen/Fraunces) / [Figtree](https://fonts.google.com/specimen/Figtree) / [JetBrains Mono](https://www.jetbrains.com/lp/mono/)
