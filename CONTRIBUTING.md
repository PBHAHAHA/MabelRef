# 贡献指南 / Contributing

感谢你愿意改进 MabelRef。这个项目希望保持小而稳定、清晰可维护。

English: Thank you for improving MabelRef. The project aims to stay small, stable, and easy to maintain.

## 开始之前

较大的改动请先开 issue 讨论。小型文档修正、错别字修正和聚焦的 bug 修复可以直接提交 pull request。

好的贡献通常只有一个清晰目标：

- 修复可复现的 bug
- 改进已有文档中的工作流
- 在不改变行为的前提下简化代码
- 增加小而可测试的功能
- 提升发布、打包或签名可靠性

English: For large changes, please open an issue first. Small documentation fixes and focused bug fixes can go directly to a pull request.

## 开发环境

```bash
npm install
npm run dev
```

提交前运行检查：

```bash
npm run lint
npm test
```

如果检查因为既有技术债失败，请在 pull request 中说明。新的改动不应增加新的失败。

## Pull Request 规则

- 保持改动聚焦。
- 说明用户可见的行为变化。
- 修改共享逻辑时添加或更新测试。
- 修改命令、发布流程、文件格式或贡献流程时同步更新文档。
- 不要提交密钥、证书、私钥、本地 `.env` 文件、构建产物或安装包。

English:

- Keep changes focused.
- Describe user-visible behavior changes.
- Add or update tests when changing shared logic.
- Update documentation when changing commands, release behavior, file formats, or contributor workflows.
- Do not commit secrets, certificates, private keys, local `.env` files, generated build output, or packaged installers.

## Commit 风格

使用清晰、祈使句风格的提交信息：

```text
Fix project rename conflict handling
Document Windows signing workflow
Add shortcut serialization tests
```

## 架构边界

MabelRef 按 Electron 进程边界组织：

- `src/main/`: 原生桌面能力、文件系统访问、IPC handler、打包相关行为
- `src/preload/`: 向渲染进程暴露窄 API 桥
- `src/renderer/`: Vue UI 与画布工作流
- `src/shared/`: 可被 Node 测试覆盖的项目、包格式、图库数据逻辑

新逻辑应尽量靠近拥有该职责的边界。共享代码应保持依赖少、可测试。

English: Keep new logic close to the boundary that owns it. Shared code should stay dependency-light and testable with Node.

## 文档

公开项目文档位于仓库根目录和 `docs/`。当发布行为、签名行为、项目文件格式或贡献者预期发生变化时，请在同一个 pull request 中更新相关文档。
