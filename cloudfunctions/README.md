# cloudfunctions 目录

本目录用于存放 Love Court 小程序的微信云开发云函数。

## 云函数清单

| 云函数 | 作用 | 是否需要环境变量 |
|--------|------|------------------|
| `healthCheck` | 健康检查，返回云环境信息与 openid | 否 |
| `aiVerdict` | AI 裁决生成（调用 DeepSeek） | **是**：`DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL` |
| `aiQuestion` | AI 追问生成（先匹配规则，未命中再调用 AI） | **是**：`DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL` |
| `_common` | 共享业务逻辑（**不是云函数**，供上述函数 require） | 否 |

## healthCheck 云函数

**作用：** 用于连通性验证的健康检查云函数。调用后会返回当前云环境信息（`env`）、调用者的 `openid` / `unionid` / `appid`，以及调用时间戳和传入的 `event`。

返回结构示例：

```json
{
  "ok": true,
  "env": "cloud-env-id",
  "openid": "oxxxxxxx",
  "timestamp": 1700000000000
}
```

## aiVerdict 云函数

**作用：** 接收案件上下文，调用 DeepSeek 生成娱乐裁决 JSON。

**入参：**
```json
{
  "case": {
    "title": "案件标题",
    "plaintiffName": "原告昵称",
    "defendantName": "被告昵称",
    "plaintiffStatement": "原告陈词",
    "defendantStatement": "被告陈词"
  }
}
```

**返回：**
```json
{
  "ok": true,
  "verdict": { /* Verdict 对象 */ },
  "provider": "deepseek",
  "model": "deepseek-v4-flash"
}
```

`provider` 可能值：`deepseek`（AI 生成）、`local-rules`（API Key 未配置）、`local-rules-fallback`（调用失败兜底）。

## aiQuestion 云函数

**作用：** 接收案件上下文，生成 AI 追问。先尝试关键词规则匹配（节省成本），未命中再调用 AI。

**入参：** 同 aiVerdict

**返回：**
```json
{
  "ok": true,
  "question": "请双方分别说明：...",
  "provider": "local-rules"
}
```

## _common 目录

**注意：此目录不是云函数，不会被部署。** 它是 `aiVerdict` 和 `aiQuestion` 的共享业务逻辑代码，包含：
- 本地规则裁决（`buildVerdict`）
- 本地规则追问（`buildQuestion`）
- AI 返回校验（`normalizeAiVerdict`）
- Prompt 模板

通过相对路径 `require('../_common/verdict-builder')` 引用。

## 部署方式

### 1. 部署云函数代码

1. 打开微信开发者工具
2. 左侧资源管理器找到 `cloudfunctions/<函数名>` 目录
3. 右键点击 → **「上传并部署：云端安装依赖（不上传 node_modules）」**
4. 等待上传完成（首次约 30 秒 - 1 分钟）

### 2. 配置环境变量（仅 aiVerdict 和 aiQuestion 需要）

**关键步骤：API Key 必须配置在云函数环境变量中，不在前端。**

1. 云开发控制台 → 云函数 → `aiVerdict` → 配置
2. 添加环境变量：
   - `DEEPSEEK_API_KEY` = `sk-你的真实APIKey`
   - `DEEPSEEK_MODEL` = `deepseek-v4-flash`
3. 对 `aiQuestion` 重复以上配置

### 3. 验证部署

详见 [AI_CLOUD_MIGRATION.md](../docs/wechat-cloud-architecture/AI_CLOUD_MIGRATION.md)

## 注意事项

- **本地不需要安装 `wx-server-sdk`**，云端会在部署时自动安装 `package.json` 中声明的依赖。
- **`_common` 目录会随云函数一起上传**（作为相对路径依赖），无需单独部署。
- 请勿将 `node_modules` 目录上传至云端。
- **API Key 不出现在前端代码、`.env.*`、git 历史中**，仅在云函数环境变量配置。
