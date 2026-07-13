# canvas/

> L2 | 父级: /src/renderer/src/CLAUDE.md

画布领域纯函数库（无渲染依赖）。Leafer 已火化，渲染归 engine/，这里只保留可在 Node 直测的领域算法与 DOM 输入适配器。

成员清单
canvasBatching.mjs: 纯函数批处理工具，chunkItems/getLoadBatchSize 把项目节点拆成稳定小批次
canvasHistory.mjs: 撤销历史栈，structuredClone 深拷贝快照，后进先出，undo/redo 双栈
canvasImportFiles.mjs: 纯函数导入过滤器，从拖入文件中分离图片与 .mabel 项目路径
canvasShortcuts.mjs: 纯函数快捷键识别器，将键盘事件映射为保存/复制/粘贴/撤销/排版/层级语义
clipboardImages.mjs: 纯函数剪贴板图片提取器，将 ClipboardEvent 的 files/items 统一转换为图片 File 列表
directoryEntries.mjs: 异步拖拽目录展开工具，通过 FileSystemEntry API 将文件夹递归转换为 File 列表
droppedImageSources.mjs: 纯函数拖拽 URL 提取器，识别浏览器拖入的图片 URL 与 dataURL 并转 File
imagePacking.mjs: 纯函数装箱排版算法，按图片自然尺寸、大图优先和面积目标宽度进行小间距紧凑排列，不缩放原图
selectedImageLayout.mjs: 纯函数选中图片排版，含缩放的节点布局尺寸 + 包围盒锚定的装箱重排
viewportFit.mjs: 纯函数视口算法，计算内容包围盒以及适合画布视口的缩放和居中偏移
viewportZoom.mjs: 纯函数视口缩放，锚点缩放视图、滚轮缩放因子与平移视图计算

消费方: engine/useEngineImageEditor.js（领域算法）、components/CanvasViewer.vue（输入适配）

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
