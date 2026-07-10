# shared/

> L2 | 父级: /src/CLAUDE.md

成员清单
mabelPackage.mjs: .mabel zip 包格式模块，将 manifest.json 与 assets/ 二进制图片资源打包，避免 base64 膨胀并支持快速解码
mabelLibrary.mjs: 资料库状态纯函数模块，管理工作空间路径、分类文件夹路径、最近项目和分类项目引用
mabelProject.mjs: .mabel 项目文件纯函数模块，负责编码、解码、空项目创建、结构校验与版本魔数

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
