# cloudfunctions 目录

本目录用于存放 Love Court 小程序的微信云开发云函数。

## healthCheck 云函数

**作用：** 用于连通性验证的健康检查云函数。调用后会返回当前云环境信息（`env`）、调用者的 `openid` / `unionid` / `appid`，以及调用时间戳和传入的 `event`。

典型用途：

- 验证小程序与云开发环境的连通性是否正常。
- 验证云函数调用链路（鉴权、上下文获取）是否正常工作。
- 快速获取调用者 `openid`，用于后续业务联调。

返回结构示例：

```json
{
  "ok": true,
  "env": "cloud-env-id",
  "openid": "oxxxxxxx",
  "unionid": "oxxxxxxx",
  "appid": "wxxxxxxxxxxx",
  "timestamp": 1700000000000,
  "receivedEvent": {}
}
```

## 部署方式

1. 打开微信开发者工具。
2. 在左侧资源管理器中找到 `cloudfunctions/healthCheck` 目录。
3. 右键点击该目录，选择 **「上传并部署：云端安装依赖（不上传 node_modules）」**。
4. 等待上传完成，在云开发控制台的「云函数」列表中确认 `healthCheck` 已存在且状态正常。

## 注意事项

- **本地不需要安装 `wx-server-sdk`**，云端会在部署时自动安装 `package.json` 中声明的依赖。
- 请勿将 `node_modules` 目录上传至云端。
- 如需修改依赖版本，编辑 `package.json` 后重新上传部署即可。
