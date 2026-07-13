# MabelRef

MabelRef 是一款面向创作者的轻量级桌面参考图板。它帮助插画师、设计师和视觉创作者收集参考图片、在画布上整理灵感，并保存为可迁移的 `.mabel` 项目文件。

English: MabelRef is a lightweight desktop reference board for creators. It helps artists and designers collect image references, arrange them on a canvas, and save portable `.mabel` project files.

## 功能特性

- 本地优先的桌面工作流
- 面向参考图整理的自由画布
- 可迁移的 `.mabel` 项目文件
- 最近项目与项目分类管理
- 可自定义快捷键
- 无边框窗口控制
- 基于 `electron-builder` 的跨平台打包

## 项目状态

MabelRef 正在准备成为公开开源项目。当前代码已经可以支撑本地使用，但公开发布、安装包签名、自动更新和 release 基础设施仍在整理中。

English: MabelRef is in early open source preparation. The app is usable locally, while signed installers, release automation, and public update infrastructure are still being prepared.

## 技术栈

- Electron: 桌面运行时
- Vue 3: 渲染进程 UI
- electron-vite: main、preload、renderer 三端构建
- electron-builder: 应用打包
- 自研 WebGPU 引擎: 画布渲染与编辑（Render Worker + 实例化渲染 + GPU mip 链）
- lucide-vue-next: 图标

## 快速开始

### 环境要求

- Node.js 20 或更高版本
- npm
- Git

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建

```bash
npm run build
```

### 打包

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## 目录结构

```text
src/
  main/       Electron 主进程
  preload/    主进程与渲染进程之间的安全桥
  renderer/   Vue 应用
  shared/     项目、包格式、图库等共享逻辑
build/        打包图标与平台资源
resources/    运行时静态资源
docs/         发布、签名与维护文档
tests/        Node 测试套件
```

## 质量检查

```bash
npm run lint
npm test
```

当前代码库仍可能存在历史格式与 lint 债务。新的贡献不应引入新的检查失败。

## Windows 签名

签名证书、私钥、密码和云签名凭据不得提交到仓库。Windows 签名方案、开源免费签名选项和 CI 凭据处理方式见 [Windows 签名文档](docs/windows-signing.md)。

English: Signing credentials must never be committed. See [Windows Code Signing](docs/windows-signing.md) for signing options and CI-safe credential handling.

## 贡献

欢迎在公开仓库准备完成后参与贡献。提交 issue 或 pull request 前，请先阅读 [贡献指南](CONTRIBUTING.md)。

English: Contributions are welcome once the public repository is ready. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening issues or pull requests.

## 安全

请不要在公开 issue 中披露安全漏洞。安全报告流程见 [SECURITY.md](SECURITY.md)。

## 行为准则

本项目遵循 [社区行为准则](CODE_OF_CONDUCT.md)。

## 许可证

项目正在准备公开开源发布。首次公开 release 前需要添加最终的 `LICENSE` 文件。

English: The project is preparing for open source release. Add the final `LICENSE` file before the first public release tag.
