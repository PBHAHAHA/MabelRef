# engine/editor/

> L2 | 父级: /src/renderer/src/engine/CLAUDE.md

M2 交互编辑层。所有几何数学在纯函数里（node 可测），DOM 事件只在 editorController 一处；产品语义 lockRatio——只有角点等比缩放，旋转节点因此零特殊分支。

成员清单
hitTesting.mjs: 命中测试纯函数，旋转矩形逆变换命中、AABB、置顶命中与框选矩形判定
editorTransforms.mjs: 变换纯函数，选区包围盒、四角手柄（锚点恒为对角）、投影比等比缩放与移动 patch
sceneStore.mjs: 文档单一真相源，节点增删改/选中集/订阅通知，全部不可变替换，渲染与覆盖层都是其投影
selectionOverlay.mjs: 主线程 2D 覆盖层，绘制选中轮廓、选区包围盒、角点手柄与框选矩形
editorController.mjs: 交互状态机（唯一 DOM 胶水层），指针事件翻译为选择/框选/拖拽/缩放/删除/锚点缩放/中键平移，支持 bindWheel/bindKeyboard 关闭（宿主自管快捷键）与 onHistoryPoint 手势历史点回调，数学全部委托纯函数

依赖方向: editorController → sceneStore/hitTesting/editorTransforms + canvas/viewportZoom；selectionOverlay → hitTesting/editorTransforms

待办: 旋转手柄

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
