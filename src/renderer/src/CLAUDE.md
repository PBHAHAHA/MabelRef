# renderer/src/

> L2 | 父级: /src/renderer/CLAUDE.md

成员清单
main.js: Vue renderer 启动入口，导入全局样式并挂载 App.vue
App.vue: Vue 根组件，组织自定义标题栏、工作区入口、工作区 .mabel 侧栏、分类右键新建画布与 canvas 图片查看区
canvas/: 画布领域纯函数目录（排版/历史/视口/导入适配），无渲染依赖，被 engine 与组件消费
engine/: 自研 WebGPU 渲染引擎目录，Render Worker + 实例化渲染 + 单级 GPU 纹理 + 资产管线 + Vue 接入 composable，主画布唯一渲染核
bench/: WebGPU 引擎压测页目录，独立 bench.html 入口，M1 性能验收现场
components/: Vue 子组件目录，提供工作区入口、分类导航、canvas 查看器与运行时版本信息
assets/: renderer 静态资源与全局 CSS，定义灰黑两栏图片查看器视觉基底

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
