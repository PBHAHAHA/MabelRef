# Mabel Boxs - Electron Vue desktop shell

Electron + electron-vite + Vue 3 + electron-builder
Canvas editor: leafer-editor
Icons: lucide-vue-next

<directory>
src/ - 应用代码 (3子目录: main, preload, renderer)
build/ - 打包图标与 macOS 权限资源
resources/ - 运行时静态资源
out/ - electron-vite 构建产物
</directory>

<config>
package.json - npm 脚本、Electron/Vue 依赖与打包入口
electron.vite.config.mjs - main/preload/renderer 三端 Vite 配置
electron-builder.yml - electron-builder 平台打包规则
eslint.config.mjs - Vue/Electron 项目 lint 规则
AGENT.md - GEB 分形文档系统与协作协议
</config>

法则: 极简·稳定·导航·版本精确
