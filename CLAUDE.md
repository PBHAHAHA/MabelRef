# MabelRef - Electron Vue Desktop Shell

Electron + electron-vite + Vue 3 + electron-builder
Canvas engine: 自研 WebGPU 渲染引擎（Render Worker + 实例化渲染 + GPU mip 链）
Icons: lucide-vue-next

<directory>
src/ - 应用代码 (4子目录: main, preload, renderer, shared)
build/ - 打包图标与 macOS 权限资源
resources/ - 运行时静态资源
docs/ - 项目说明与发布协议
tests/ - Node 测试套件
out/ - electron-vite 构建产物
dist/ - electron-builder 打包产物
</directory>

<config>
package.json - npm 脚本、Electron/Vue 依赖与打包入口
electron.vite.config.mjs - main/preload/renderer 三端 Vite 配置
electron-builder.yml - electron-builder 平台打包规则
eslint.config.mjs - Vue/Electron 项目 lint 规则
AGENT.md - Agent 协作与维护规范
AGENTS.md - 仓库级 Agent 快速规则
README.md - 开源项目主页与开发入口
CONTRIBUTING.md - 贡献流程
SECURITY.md - 安全披露策略
CODE_OF_CONDUCT.md - 社区行为准则
CHANGELOG.md - 版本变更记录
</config>

法则: 极简·稳定·导航·版本精确
