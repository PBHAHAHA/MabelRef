# renderer/src/
> L2 | 父级: /src/renderer/CLAUDE.md

成员清单
main.js: Vue renderer 启动入口，导入全局样式并挂载 App.vue
App.vue: Vue 根组件，组织自定义标题栏、工作区入口、工作区 .mabel 侧栏、分类右键新建画布与 canvas 图片查看区
canvas/: Leafer 画布领域逻辑目录，隔离编辑器状态、图片节点和排版算法
components/: Vue 子组件目录，提供工作区入口、分类导航、canvas 查看器与运行时版本信息
assets/: renderer 静态资源与全局 CSS，定义灰黑两栏图片查看器视觉基底

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
