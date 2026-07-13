# bench/

> L2 | 父级: /src/renderer/src/CLAUDE.md

WebGPU 引擎实验室（M1 渲染核 + M2 交互层验收现场），独立 HTML 入口 `src/renderer/bench.html`，主应用内 Ctrl+Alt+B 打开。M3/M4 已落地：主应用画布走 engine/useEngineImageEditor，Leafer 已移除；本目录继续作为引擎压测与回归现场。

成员清单
benchScene.mjs: 场景纯函数，确定性伪随机图片规格、O(n) 货架排版与随时间振荡的缩放视口（复用 canvas/viewportFit），node 可测
benchTextures.mjs: 程序化纹理工厂，OffscreenCanvas 2D 绘制细线网格/圆环/文字（高频细节检验 mip 过滤质量）后转 ImageBitmap
benchMain.js: 实验室入口，分批生成上传 N 张大图，先跑振荡动画量帧率，任意指针交互接管为编辑模式（engine/editor 全家桶）

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
