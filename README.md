![CodeTogether](https://raw.githubusercontent.com/kermanx/codetogether/main/assets/internal/social-preview.png)

[![Version](https://img.shields.io/github/v/release/kermanx/codetogether)](https://marketplace.visualstudio.com/items?itemName=kermanx.codetogether) <!-- [![Installs](https://img.shields.io/visual-studio-marketplace/i/kermanx.codetogether)](https://marketplace.visualstudio.com/items?itemName=kermanx.codetogether) --> [![reactive-vscode](https://img.shields.io/badge/made_with-reactive--vscode-%23007ACC?style=flat&labelColor=%23229863)](https://kermanx.com/reactive-vscode/)

Real-time collaborative coding for VS Code.

This VS Code extension enables real-time collaborative editing, and...

- Remote Language Service
- Terminal Sharing
- Port Forwarding
- Chat with Images
- Text Selection Sync
- Workspace Files Sync

To start sharing, <a target="_blank" href="https://redirect.kermanx.workers.dev/vscode:extension/kermanx.codetogether">install the extension</a>, then click **Share** in the CodeTogether panel on the [activity bar](https://code.visualstudio.com/docs/getstarted/userinterface#_basic-layout). No account or sign-in required. Beyond [trystero](https://github.com/dmotz/trystero)'s public signaling servers, you can [self-host a relay server](#self-hosted-relay-server) for better security and connectivity.

![Screenshot](https://raw.githubusercontent.com/kermanx/codetogether/main/assets/internal/screenshot.png)

<!-- #### VS Code Web Support

This extension also works in [VS Code Web](https://vscode.dev/). You can join a session on your browser after installing the extension, and enjoy the same collaborative editing features, terminals and language service provided by the host. -->

## Connectivity

### Secure Peer-to-Peer Connections

Powered by [trystero](https://github.com/dmotz/trystero), CodeTogether establishes direct connections between peers using WebRTC. You can choose "trystero:mqtt" (preferred) or "trystero:nostr" when sharing to leverage the public signaling servers. Your data is encrypted end-to-end with the invitation link.

### Self-Hosted Relay Server

Besides Peer-to-Peer connections, you can also self-host a WebSocket relay server to improve connectivity.

```bash
bunx codetogether-ws-server@latest
# Supports --port and --hostname options
```

Or you can run the pre-built binary [ws-server](https://github.com/kermanx/codetogether/releases/latest/download/ws-server).

### Direct Host

The host can directly listen for incoming WebSocket connections without a relay server. This is useful when the guests can directly connect to the host. You can enable this by choosing "Host Locally" and selecting a network interface when sharing.

<details>
<summary>Tencent Cloud Serverless</summary>

对于中国用户，若需自行部署，目前作者找到的较好方案是腾讯云的 Serverless 云函数：

- 新用户前三个月免费
- 假设每月调用 30 次，每次 60 分钟，流量共 300M，则费用约为 1 元
- 实测单程延迟（client -> host）约为 35ms

**部署步骤：**

1. 打开腾讯云 Serverless 云函数（不是 Serverless Container）

2. 新建函数，选择以下配置：

    - 创建方式：从头开始
    - 函数类型：Web函数
    - 运行环境：Go 1
    - 函数代码：选择“本地上传 zip 包”，上传 [serverless.zip](https://github.com/kermanx/codetogether/releases/latest/download/serverless.zip)
    - 高级配置：
      - 内存：64MB
      - 请求多并发：自定义静态并发，设置为 100
      - WebSocket 支持：启用，空闲时间设置为 120 秒
    - 函数 URL 配置：开启公网访问

3. 部署完成后，进入“函数 URL”栏目，复制公网访问的 `wss://` 地址。在 VS Code 中点击 Share 后，填入该地址即可。

</details>

## Disclaimer

This project is released under the MIT License. It is not affiliated with, endorsed by, or sponsored by Microsoft Corporation.

This project is intended for real-time code collaboration in VS Code. Some advanced collaboration features rely on VS Code APIs and local runtime capabilities.

This project is not stable yet. Please make sure to only share non-sensitive files. The author is not responsible for any data loss or leakage.

Part of the code under the `src/terminal/pty` folder is adapted from VS Code.
