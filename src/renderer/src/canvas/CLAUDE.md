# canvas/
> L2 | 父级: /src/renderer/src/CLAUDE.md

成员清单
clipboardImages.mjs: 纯函数剪贴板图片提取器，将 ClipboardEvent 的 files/items 统一转换为图片 File 列表
imagePacking.mjs: 纯函数装箱排版算法，按图片自然尺寸、大图优先和面积目标宽度进行小间距紧凑排列，不缩放原图
useLeaferImageEditor.js: Vue composable，初始化 leafer-editor，批量导入自然尺寸图片节点，支持鼠标位置粘贴与选中图片快速排版，管理装箱排版、自动缩放居中、图片原始路径选择状态、.mabel 项目快照、大范围缩放与对象 URL 释放
viewportFit.mjs: 纯函数视口算法，计算内容包围盒以及适合画布视口的缩放和居中偏移

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
