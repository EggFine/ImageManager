<div align="center">

# ImageManager

[🇨🇳 中文](./README.md) · **🇬🇧 English**

OpenAI-compatible image API desktop client · editorial atelier aesthetic · Tauri 2 + React 19

</div>

---

## Overview

ImageManager is a desktop client for the **OpenAI image API and any compatible gateway** (`gpt-image-2`, `gpt-image-1.5`, `gpt-image-1`, …). It is not pinned to OpenAI's endpoint — any gateway that speaks `/v1/images/generations` and `/v1/images/edits` works.

The visual language borrows from the **editorial atelier**: warm cream paper, rust accent, serif display type set against mono metadata. Every ornament defers to legibility and accessibility (WCAG AA throughout, AAA in places).

## Features

- 🎨 **Generation & edit (with mask)** — full coverage of `/images/generations` and `/images/edits`
- 🔄 **Streaming preview** — live `partial_image` updates (up to 3 intermediate frames)
- 📐 **Full gpt-image-2 size support** — up to 3840×2160 (4K), auto-aligned to 16, with 1:3–3:1 ratio enforcement
- 💾 **Portable mode** (Windows) — `config.json` sits next to the `.exe`, take the whole folder anywhere
- 🌍 **First-class i18n** — Simplified Chinese / English, follows system preference
- 🎚️ **Light / Dark / System themes** — instant switch, consistent warm palette
- ⚡ **Keyboard-first** — `Ctrl 1-4` to navigate, `Ctrl + Enter` to submit, `Ctrl ,` for settings
- 📱 **Responsive 720 → 4K** — sidebar auto-collapses, type scales by step, content reflows
- 🔒 **Local-only configuration** — no telemetry, ever

## Screenshots

> TODO — see `docs/screenshots/` (not yet committed).

## Download

Pick your platform from the [Releases page](../../releases):

| Platform | Asset | How to install |
|----------|-------|----------------|
| **Windows** (x64) | `ImageManager_x.y.z_x64_en-US.msi` | Double-click |
| **Windows portable** | `ImageManager.exe` (extracted) | Drop into any folder, run |
| **macOS** (Universal) | `ImageManager_x.y.z_universal.dmg` | Drag into Applications |
| **Linux** | `.AppImage` / `.deb` | See notes below |

### Linux notes

- AppImage: `chmod +x ImageManager_*.AppImage && ./ImageManager_*.AppImage`
- deb: `sudo dpkg -i ImageManager_*.deb`
- Requires `libwebkit2gtk-4.1` to be present on the system.

## First run

1. Launch the app → lands on the **Home** page (Hi. I'm ImageManager.)
2. Open **Settings** (`Ctrl 4`) → fill in:
   - `base_url` (defaults to `https://api.openai.com/v1`, or point it at your gateway)
   - `api_key` (`sk-...`)
3. Back to **Generate** (`Ctrl 2`), type a prompt → `Ctrl Enter` to submit

## Configuration file location

| Platform | Path |
|----------|------|
| **Windows** | `<exe_dir>\config.json` 🍃 portable mode |
| **macOS** | `~/Library/Application Support/com.imagemanager.app/config.json` |
| **Linux** | `~/.config/com.imagemanager.app/config.json` |

> Every change **auto-saves**. `Switch` / `Select` / `NumberInput` write immediately; text fields (`base_url`, `api_key` …) commit on blur.

The bottom of the Settings page has **Open in default app** and **Show in Explorer** buttons that jump straight to the file.

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl 1` | Home |
| `Ctrl 2` | Generate |
| `Ctrl 3` | Edit |
| `Ctrl 4` / `Ctrl ,` | Settings |
| `Ctrl + Enter` | Submit current page (generate / edit) |
| `Esc` | Close any open popover / combobox |
| `↑ / ↓ / Enter / Esc` | Navigate inside Combobox |

On macOS, `Cmd` works in place of `Ctrl` (so `⌘ 1`, `⌘ + Enter`, …).

## Supported models

Native target is the `gpt-image-2` family, but `base_url` is unconstrained — anything that speaks OpenAI's image API contract works:

- `gpt-image-2` (default — up to 4K, auto high-fidelity)
- `gpt-image-1.5` / `gpt-image-1` / `gpt-image-1-mini`
- `dall-e-2` / `dall-e-3` (legacy, retired 2026-05-12; kept for compat)

### gpt-image-2 size constraints

- Both dimensions must be **divisible by 16**
- Aspect ratio between **1:3 and 3:1**
- Max edge **3840 px**
- Total pixels in **655,360 — 8,294,400**
- Sizes above 2560×1440 are flagged "experimental" upstream (still succeed)

The app rounds and clamps automatically per the rules above; the actual size to be sent is shown live in the UI.

## Development

### Toolchain

- [Bun](https://bun.sh/) ≥ 1.0
- [Rust](https://rustup.rs/) stable
- Platform deps:
  - Windows: MSVC build tools
  - macOS: Xcode Command Line Tools
  - Linux: `libwebkit2gtk-4.1-dev` `librsvg2-dev` `libayatana-appindicator3-dev` `patchelf`

### Commands

```bash
bun install            # install frontend deps
bun run tauri dev      # dev mode (HMR + Rust shell)
bun run tauri build    # produce a release binary in src-tauri/target/release/
```

### Layout

```
src/
  components/     UI primitives (Shell / TitleBar / Page / SizeSelector / ResultsView / ui/*)
  pages/          Route pages (HomePage / GeneratePage / EditPage / SettingsPage)
  services/       Business logic (apiClient / config / sizeCalc / store)
  styles/         Global CSS + Tailwind v4 theme
  i18n/           zh.ts / en.ts / init logic
src-tauri/
  capabilities/   Tauri permissions
  src/            Rust entry (mostly empty — frontend-driven app)
  tauri.conf.json Window / bundle / identifier
.github/
  workflows/
    release.yml   Cross-platform build + auto-release
```

### Stack

- **Tauri 2** — Rust shell + WebView frontend host
- **React 19** + **TypeScript** + **Vite 7**
- **Tailwind CSS v4** + a hand-rolled editorial design system
- **Radix UI** — unstyled primitives (Select, Switch, Toast, Label, …)
- **lucide-react** — icons
- **zustand** — state
- **i18next** + **react-i18next**
- **Fraunces / Figtree / JetBrains Mono** (fontsource-variable)

## Release process

1. Bump the version in three places:
   - `package.json`'s `version`
   - `src-tauri/tauri.conf.json`'s `version`
   - `src-tauri/Cargo.toml`'s `version`
2. `git tag v0.1.0 && git push origin v0.1.0`
3. GitHub Actions picks up the tag and runs [`release.yml`](.github/workflows/release.yml), which builds Windows / macOS Universal / Linux in parallel.
4. Artifacts land in a **draft release** — review them and click Publish to ship.

You can also trigger the workflow manually from the Actions tab via `workflow_dispatch` (pass a tag name).

## Known limitations

- **Wayland window dragging on Linux**: some Wayland compositors handle `tauri-drag-region` inconsistently — you may need to drag via the app icon.
- On first launch, if `api_key` is empty, the status bar shows an amber warning dot and prompt.

## Per-platform differences

| Platform | Title bar | Window controls |
|----------|-----------|-----------------|
| **macOS** | Native traffic-light overlay, no title text | System red/yellow/green buttons on the left |
| **Windows / Linux** | Custom editorial title bar ("●  IMAGEMANAGER · Atelier") | Custom `_  □  ×` on the right |

## License

MIT — use freely, PRs welcome.

## Acknowledgements

- [OpenAI](https://openai.com/) — image generation API
- [Tauri](https://tauri.app/) — lightweight desktop framework
- [Radix UI](https://www.radix-ui.com/) — accessible primitives
- [Lucide](https://lucide.dev/) — icon set
- Fonts: [Fraunces](https://fonts.google.com/specimen/Fraunces) / [Figtree](https://fonts.google.com/specimen/Figtree) / [JetBrains Mono](https://www.jetbrains.com/lp/mono/)
