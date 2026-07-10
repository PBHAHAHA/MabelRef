# 开源发布指南 / Open Source Release Guide

本指南用于跟踪 MabelRef 公开开源前需要完成的工作。

English: This guide tracks the work required before MabelRef is published as a public open source project.

## 发布准备

首次公开仓库前，请完成以下事项：

- 添加最终的 `LICENSE` 文件。
- 确认公开仓库 URL 和 package homepage。
- 移除私有 endpoint、账号名、token、证书和本地专用文件。
- 决定公开 release 通过 GitHub Releases、项目官网，或两者同时分发。
- 确定首批支持的平台。
- 启用私密漏洞报告，或公布安全联系渠道。
- 确认构建产物没有被提交。

English:

- Add the final license file.
- Confirm the public repository URL and package homepage.
- Remove private endpoints, account names, tokens, certificates, and local-only files.
- Decide whether releases are distributed through GitHub Releases, the project website, or both.
- Define the first supported platforms.
- Enable private vulnerability reporting or publish a security contact.
- Verify that generated build output is not committed.

## 仓库元信息

一个专业的公开仓库通常需要：

- `README.md`: 项目介绍与开发入口
- `CONTRIBUTING.md`: 贡献规则
- `SECURITY.md`: 漏洞报告流程
- `CODE_OF_CONDUCT.md`: 社区行为预期
- `CHANGELOG.md`: release notes
- `LICENSE`: 首次公开 release 前必须明确许可证

## 许可证选择

在接受外部贡献前，请先确定许可证。

常见选择：

- MIT: 简单、宽松、广泛理解
- Apache-2.0: 宽松，并包含明确专利授权
- GPL-3.0: copyleft 许可证，要求衍生作品继续开源

没有 `LICENSE` 文件前，不应正式宣传项目已经开源。

English: Choose the license before accepting outside contributions. Do not advertise the project as open source until the license is present in the repository.

## 签名与开源

开源不等于公开签名凭据。仓库可以包含：

- 构建配置
- 非敏感签名 profile 名称
- 发布文档
- 验证命令

仓库绝不能包含：

- PFX/P12 文件
- 私钥
- 证书密码
- Azure tenant/client secrets
- 供应商账号 token
- 更新服务器凭据

English: Open source does not mean public signing credentials. Keep certificates, private keys, passwords, cloud secrets, vendor tokens, and update server credentials out of the repository.

## 推荐发布流程

使用公开源码 tag 和私有签名凭据：

1. 合并 release-ready 代码。
2. 创建版本 tag。
3. 从该 tag 运行 CI。
4. 构建平台产物。
5. 仅在 release job 中签名。
6. 验证签名。
7. 同步发布安装包和更新元数据。

English: Use public source tags and private signing credentials. Build from a tag, sign only inside the release job, verify signatures, and publish artifacts with update metadata together.
