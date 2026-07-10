# Windows 签名 / Windows Code Signing

MabelRef 使用 `electron-builder` 打包 Windows 应用。签名凭据属于发布基础设施，不属于源码，必须保留在公开仓库之外。

English: MabelRef uses `electron-builder` for Windows packaging. Signing credentials are release infrastructure, not source code, and must stay outside the public repository.

## 目标

Windows 签名应满足：

- 提供可验证的发布者身份
- 让安装包和可执行文件具备篡改检测能力
- 支持 CI 自动化发布
- 不提交私钥或签名密码
- 适配开源项目的发布流程

English: Windows signing should provide publisher identity, tamper detection, CI-friendly automation, no committed private keys or passwords, and a path that works for open source releases.

## 推荐的开源免费方案

公开开源后，优先评估 [SignPath Foundation](https://signpath.org/)。它为符合条件的开源项目提供免费的托管代码签名流程。

这个模型适合开源项目，因为：

- 私钥不会分发给维护者
- 签名与公开源码和构建流程绑定
- release 可以在不提交凭据的前提下完成签名
- 资格和审批规则让签名过程更可审计

如果 MabelRef 后续需要使用自己的发布者身份，可以迁移到 Azure Trusted Signing 或商业 OV/EV 证书。

English: For public open source releases, evaluate SignPath Foundation. It provides free code signing for eligible open source projects through a hosted workflow. If MabelRef later needs its own publisher identity, move to Azure Trusted Signing or a commercial certificate.

## Azure Trusted Signing

当项目拥有付费签名账号，并希望在 CI 中托管签名时，Azure Trusted Signing 是一个稳妥选择。

在发布者身份确定后，只把非敏感 profile 元数据写入 `electron-builder.yml`：

```yaml
win:
  executableName: MabelRef
  azureSignOptions:
    publisherName: "YOUR_CERTIFICATE_COMMON_NAME"
    endpoint: "YOUR_TRUSTED_SIGNING_ENDPOINT"
    certificateProfileName: "YOUR_CERTIFICATE_PROFILE"
    codeSigningAccountName: "YOUR_SIGNING_ACCOUNT"
```

Azure 凭据只应通过 release 环境提供，例如 GitHub Actions secrets 或私有本地 shell。

English: Add only non-secret profile metadata to `electron-builder.yml`. Provide Azure credentials only through the release environment.

## PFX 备用方案

如果使用传统证书文件，不要提交证书。通过环境变量提供证书路径和密码：

```bash
export WIN_CSC_LINK="/absolute/path/to/certificate.pfx"
export WIN_CSC_KEY_PASSWORD="certificate-password"
npm run build:win
```

在 macOS 上，`WIN_CSC_LINK` 和 `WIN_CSC_KEY_PASSWORD` 可以让 Windows 证书与 macOS 签名身份保持分离。

English: If using a traditional certificate file, do not commit it. Provide the certificate path and password through environment variables.

## 本地无签名构建

无签名开发构建适合验证打包流程：

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:win
```

这可以避免 `electron-builder` 在测试构建时意外使用本地签名身份。

## 验证签名

在 Windows 上验证已签名安装包：

```powershell
Get-AuthenticodeSignature .\dist\mabelref-1.0.0-setup.exe
```

签名状态应为 `Valid`，签名方应与预期发布者或签名机构一致。

English: The signature status should be `Valid`, and the signer should match the expected publisher or signing foundation.

## Release Checklist

1. 从干净的 release tag 构建。
2. 只在批准的 release 环境中签名。
3. 验证安装包签名。
4. 同步发布安装包和更新元数据。
5. 避免凭据出现在日志和构建产物中。

English: Build from a clean tag, sign only in the release environment, verify the installer signature, publish artifacts with update metadata, and keep credentials out of logs and artifacts.

## References

- [Electron code signing](https://electronjs.org/docs/latest/tutorial/code-signing)
- [electron-builder Windows signing](https://www.electron.build/docs/features/code-signing/code-signing-win/)
- [SignPath Foundation](https://signpath.org/)
- [Azure Artifact Signing](https://azure.microsoft.com/en-us/products/artifact-signing)
