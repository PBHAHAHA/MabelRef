# 变更日志 / Changelog

MabelRef 的重要变更会记录在此文件中。

English: Notable changes to MabelRef will be documented in this file.

本项目目前使用人工维护的 release notes。正式版本策略会在首次公开 release 前确定。

## Unreleased

- 新增自研 WebGPU 渲染引擎（M1 渲染核）：渲染循环运行在独立 Worker，实例化四边形 + GPU mip 链，任意缩放级别即时清晰；主应用内 Ctrl+Alt+B 打开千图压测页验收性能。
- 新增引擎交互编辑层（M2）：点选/Shift 多选/框选/拖拽/角点等比缩放/Delete 删除/锚点滚轮缩放/中键平移，几何数学全部为可测纯函数，压测页任意点击即进入编辑模式。
- 新增引擎资产管线（M3）：原始图片字节只保留在资产表供 .mabel 导出，GPU 仅持面积封顶（2560x1600）的显示位图纹理，SVG 走 <img> 解码回退；删除图片即时释放对应显存纹理。
- 主应用画布切换到 WebGPU 引擎（M4）：CanvasViewer 改用 engine/useEngineImageEditor（与旧 API 同构），导入/粘贴/复制/删除/排版/层级/缩放/灰度/撤销重做/项目快照/AI 换图全量迁移；移除 leafer-editor 依赖与全部 Leafer 模块。
- 画布加载图片（拖入导入、粘贴、打开项目）时弹出模态进度框，进度完成前阻断画布交互，避免加载中误操作。
- 准备中文优先、保留英文说明的开源项目文档。
- 补充 Windows 签名与发布安全说明。
- 增加贡献、安全、行为准则和变更日志文档。

English:

- Added an in-house WebGPU render engine (M1 render core): render loop runs in a dedicated worker with instanced quads and GPU mip chains for instant sharpness at any zoom; press Ctrl+Alt+B in the app to open the 1000-image benchmark page.
- Added the engine interaction layer (M2): click/shift multi-select, box select, drag move, uniform corner scaling, delete, anchored wheel zoom and middle-button panning; all geometry lives in unit-tested pure functions, and any click on the benchmark page enters edit mode.
- Added the engine asset pipeline (M3): original image bytes stay in the asset table for .mabel export only, the GPU holds area-capped (2560x1600) display bitmaps with an <img> decode fallback for SVG, and deleting images frees their VRAM textures immediately.
- Switched the main app canvas to the WebGPU engine (M4): CanvasViewer now uses engine/useEngineImageEditor (API-compatible with the old composable) covering import/paste/copy/delete/layout/layering/zoom/grayscale/undo-redo/project snapshots/AI image replacement; removed the leafer-editor dependency and all Leafer modules.
- Added a modal loading dialog with progress while images load (drag import, paste, open project); canvas interaction is blocked until loading completes.
- Prepared Chinese-first open source documentation with English summaries.
- Documented Windows signing and release security expectations.
- Added contributing, security, code of conduct, and changelog documents.
