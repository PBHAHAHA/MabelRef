# shared/

> L2 | 父级: /src/CLAUDE.md

成员清单
mabelLibrary.mjs: .mabel 项目库兼容模块，委托 mabelWorkspace 将分类目录和项目文件归一化为侧栏树结构
mabelPackage.mjs: .mabel zip 包格式模块，将 manifest.json 与 assets/ 二进制图片资源打包，避免 base64 膨胀并支持快速解码
mabelProject.mjs: .mabel 项目文件纯函数模块，负责编码、解码、空项目创建、结构校验与版本魔数
mabelWorkspace.mjs: Mabel 工作区纯函数模块，负责 manifest、工作区分类树归一化、项目重命名路径与路径归属判断

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
