# AI 能力云函数迁移指南

> 适用范围：feature/wechat-cloud-adaptation 分支
> 相关云函数：`aiVerdict`、`aiQuestion`

## 1. 架构说明

```
小程序前端
    ↓ wx.cloud.callFunction
aiVerdict / aiQuestion 云函数
    ↓ fetch
DeepSeek API（API Key 仅在云函数环境变量）
```

**安全保证：** DeepSeek API Key 仅存储在云函数环境变量中，**完全不暴露在前端代码、构建产物、git 历史**。

## 2. 云函数清单

| 云函数 | 作用 | 触发方式 |
|--------|------|---------|
| `aiVerdict` | 接收案件上下文，生成 AI 裁决（DeepSeek） | `wx.cloud.callFunction({ name: 'aiVerdict', data: { case } })` |
| `aiQuestion` | 接收案件上下文，生成 AI 追问 | `wx.cloud.callFunction({ name: 'aiQuestion', data: { case } })` |

## 3. 部署步骤

### 3.1 部署云函数代码

在微信开发者工具中：

1. 左侧文件树展开 `cloudfunctions` 目录
2. 右键 `aiVerdict` → 「上传并部署：云端安装依赖（不上传 node_modules）」
3. 等待上传完成（首次约 30 秒）
4. 同样操作部署 `aiQuestion`
5. `_common` 目录会随云函数一起上传（作为相对路径依赖）

### 3.2 配置 DeepSeek API Key 环境变量

**关键步骤：API Key 必须配置在云函数环境变量中，不在前端。**

1. 打开「云开发」控制台 → 「云函数」
2. 找到 `aiVerdict` → 点击进入详情
3. 点击「版本管理」或「环境变量」（根据微信开发者工具版本不同位置略有差异）
4. 添加环境变量：
   - `DEEPSEEK_API_KEY` = `sk-你的真实APIKey`
   - `DEEPSEEK_MODEL` = `deepseek-v4-flash`
5. 保存
6. 对 `aiQuestion` 重复以上配置

### 3.3 验证部署

**在云函数控制台测试 `aiVerdict`：**

输入：
```json
{
  "case": {
    "title": "他打游戏不陪我",
    "plaintiffName": "小美",
    "defendantName": "小张",
    "plaintiffStatement": "周末我们约定去看电影，结果他一整天打游戏不接电话",
    "defendantStatement": "我承认忘了约定，当时正打排位赛无法暂停"
  }
}
```

预期返回：
```json
{
  "ok": true,
  "verdict": {
    "ratio": { "plaintiff": 30, "defendant": 70 },
    "focus": ["...", "...", "..."],
    "facts": "...",
    "reason": "...",
    "quote": "...",
    "penalty": "...",
    "indices": { "hardMouth": 78, "grievance": 75, "coaxDifficulty": 50, "oldScoreRisk": 36 },
    "settlement": "...",
    "reasoning": [...]
  },
  "provider": "deepseek",
  "model": "deepseek-v4-flash"
}
```

## 4. 客户端调用方式

### 4.1 自动启用（推荐）

设置 `.env.development` 或 `.env.production`：
```
TARO_APP_CLOUD_ENABLED=true
```

应用启动后自动初始化云开发，`courtApi.buildVerdict` 会优先调用云函数。

### 4.2 降级链路

当云函数不可用时，自动降级：
```
本地案件（local-*） → 本地规则裁决
↓
云函数可用 → aiVerdict 云函数（AI 裁决）
↓ 失败
自建后端（/api/cases/:id/verdict）
↓ 失败
本地规则兜底
```

## 5. 入参与返回格式

### aiVerdict

**入参：**
```javascript
{
  case: {
    title: string,
    plaintiffName: string,
    defendantName: string,
    plaintiffStatement: string,
    defendantStatement: string,
    plaintiffAnswer?: string,
    defendantAnswer?: string,
    question?: string,
    caseNumber?: string
  }
}
```

**返回：**
```javascript
{
  ok: true,
  verdict: { /* Verdict 对象 */ },
  provider: 'deepseek' | 'local-rules' | 'local-rules-fallback',
  model: string | null
}
```

### aiQuestion

**入参：** 同 aiVerdict

**返回：**
```javascript
{
  ok: true,
  question: string,
  provider?: 'deepseek' | 'local-rules' | 'local-rules-fallback',
  model?: string | null
}
```

## 6. 常见错误排查

### 错误 1：`errCode: -404011 cloud function execution error`

**原因：** 云函数内部报错
**排查：** 云开发控制台 → 云函数 → 日志 → 查看具体错误
**常见原因：**
- `_common` 目录未上传 → 重新部署云函数
- DeepSeek API 调用失败 → 检查 API Key 与网络

### 错误 2：`Cannot find module '../_common/verdict-builder'`

**原因：** `_common` 共享代码未随云函数上传
**解决：** 右键云函数 → 「上传并部署：云端安装依赖（不上传 node_modules）」，确保 `_common` 目录与云函数同级

### 错误 3：`provider: 'local-rules'`（未调用 AI）

**原因：** API Key 未配置或为空
**解决：** 云函数控制台 → 环境变量 → 配置 `DEEPSEEK_API_KEY`

### 错误 4：`provider: 'local-rules-fallback'`（AI 调用失败）

**原因：** DeepSeek API 返回非 2xx 或网络异常
**解决：** 检查 API Key 是否有效、是否有余额、网络是否正常

### 错误 5：客户端 Console 显示 `[CourtAPI] cloud AI failed, fallback`

**原因：** 云函数调用异常，已自动降级到本地规则
**排查：** Console 中有完整错误信息，按上面步骤检查

## 7. 关闭云 AI（回退到自建后端或本地规则）

修改 `.env.development`：
```
TARO_APP_CLOUD_ENABLED=false
```

应用会自动走原有链路（自建后端 + 本地兜底），所有功能保持可用。
