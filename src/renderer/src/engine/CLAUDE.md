# engine/

> L2 | 父级: /src/renderer/src/CLAUDE.md

MabelRef 2.0 自研 WebGPU 渲染引擎（M1 渲染核 + M3 资产管线 + M4 Vue 接入）。渲染循环独占 Render Worker，主线程只发命令；图片上传只创建单级纹理，优先缩短大批量图片加载时间。原始 bytes 只存资产表供 .mabel 导出，GPU 只持面积封顶的显示位图纹理。

成员清单
editor/: M2 交互编辑层子目录，命中测试/变换数学/场景状态/选区覆盖层/交互状态机
shaders.mjs: WGSL 源码库，QUAD_SHADER 实例化四边形渲染（storage buffer 实例 + 灰度混合）；MIP_SHADER 保留作未来可选的高质量缩放实现
instanceLayout.mjs: 实例数据纯函数，每实例 12 float（旋转缩放矩阵/平移/透明度灰度/UV），并计算 world→clip 视口变换，node 可测
webgpuRenderer.mjs: GPU 渲染本体，device/管线初始化、单级纹理创建、实例缓冲上传、单遍实例化帧渲染、VRAM 估算，Worker 内运行
renderWorker.mjs: 渲染线程入口，init/resize/addImages/removeImages/setNodes/setView/start/stop/clear 消息协议，消息串行化防竞态，rAF 循环并每 500ms 回报 fps/p95/VRAM
engineClient.mjs: 主线程门面，封装 Worker 创建、OffscreenCanvas/ImageBitmap 转移与 stats/error 回调，UI 层唯一接入点
assetPipeline.mjs: 资产解码管线，getDisplaySize 面积封顶纯函数 + decodeDisplayBitmap（createImageBitmap 重采样，SVG 走 <img> 回退），getDisplaySize node 可测
useEngineImageEditor.js: Vue 接入 composable，与旧 Leafer composable 同 API（导入/粘贴/复制/删除/排版/层级/缩放/灰度/撤销重做/.mabel 快照/AI 换图），孤儿资产随删随清 VRAM

依赖方向: useEngineImageEditor → engineClient/assetPipeline/editor + canvas 纯函数；engineClient → renderWorker → webgpuRenderer/instanceLayout → shaders，单向无环

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
