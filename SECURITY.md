# 安全策略 / Security Policy

## 支持版本

MabelRef 正在准备首次公开开源发布。在稳定发布渠道确定之前，安全修复默认面向主分支。

English: MabelRef is preparing for its first public open source release. Until stable release channels are defined, security fixes target the default branch.

## 报告漏洞

请不要在公开 issue 中披露安全漏洞。

请将安全问题私下报告给项目维护者。后续如果启用专用安全邮箱或 GitHub private vulnerability reporting，本文件应在首次公开 release 前同步更新。

报告时请尽量包含：

- 受影响的版本或 commit
- 操作系统
- 复现步骤
- 预期影响
- 相关日志或示例文件

English: Please do not open public issues for security vulnerabilities. Report security concerns privately to the project maintainer, and include affected version, operating system, reproduction steps, expected impact, and relevant logs or files when possible.

## 安全敏感区域

- 项目文件解析
- `.mabel` 打包文件处理
- Electron 主进程中的文件系统访问
- preload API 暴露面
- renderer 到 main 的 IPC 校验
- release 签名与更新分发

## 签名凭据

代码签名证书、私钥、密码、云签名凭据和 release token 不得提交到本仓库。它们只能保存在可信本地环境或 CI secret store 中。

English: Code signing certificates, private keys, passwords, cloud signing credentials, and release tokens must never be committed to this repository.
