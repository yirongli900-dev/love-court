# AI情侣法庭 Love Court

情侣吵架别冷战，来开庭。

Love Court 是一个 AI 驱动的双人娱乐仲裁产品。它不是法律咨询，也不是心理咨询，而是把情侣、朋友、室友之间的小矛盾包装成一场有仪式感、轻松好笑、适合分享的“庭审”。

当前仓库是 Web MVP，用来验证核心玩法：原告发起案件，被告通过链接进入，双方陈词后由 AI 法官生成娱乐裁决和判决书分享卡。

## 技术方案文档

- [微信小游戏端到端技术方案](docs/wechat-cloud-architecture/WECHAT_CLOUD_ARCHITECTURE.md)
- [DOCX 版方案文档](docs/wechat-cloud-architecture/AI情侣法庭微信小游戏端到端技术方案.docx)
- [PDF 版方案文档](docs/wechat-cloud-architecture/AI情侣法庭微信小游戏端到端技术方案.pdf)

## 当前功能

- 创建案件，自动生成案件编号、邀请码和邀请链接
- 原告 / 被告自动身份识别，分享链接默认进入被告视角
- 双方联机陈词，服务端轮询同步案件状态
- AI 追问，补充关键事实
- DeepSeek 裁决，失败时回退到本地规则裁决
- 爱情法庭风格裁决文案
- 责任比例、娱乐处罚、和解建议
- 嘴硬指数 / 委屈指数 / 哄人难度 / 翻旧账风险
- 本案金句，强化截图传播点
- 判决书分享卡，支持正反面翻牌查看裁决理由
- 一键生成判决书 PNG
- 案件归档

## 产品流程

```text
原告发起案件
  |
  v
填写案由、双方昵称、原告陈词
  |
  v
复制邀请链接给对方
  |
  v
被告打开链接并填写被告陈词
  |
  v
AI 法官追问或直接裁决
  |
  v
生成责任比例、处罚、金句和判决书
  |
  v
复制文案 / 生成 PNG / 案件归档
```

## 技术结构

```text
love-court/
├─ index.html          # Web MVP 页面结构
├─ styles.css          # 页面样式、移动端适配、判决卡翻牌动画
├─ app.js              # 前端交互、身份识别、轮询、卡片渲染
├─ server.js           # Node.js HTTP 服务、API、AI 裁决、PNG 生成
├─ package.json        # 启动脚本与依赖
├─ package-lock.json   # 依赖锁定
├─ .env.example        # DeepSeek 环境变量示例
├─ data/               # 本地案件数据，已被 gitignore 排除
├─ shots/              # 本地截图/调试产物，已被 gitignore 排除
├─ PRD.md              # 产品需求文档
└─ ROADMAP.md          # 迭代路线图
```

## 模块关系

```text
浏览器页面
  |
  |  fetch / 轮询
  v
Node.js server.js
  |
  |-- data/cases.json
  |     本地案件存储
  |
  |-- DeepSeek API
  |     AI 裁决、金句、推理步骤
  |
  |-- sharp
        判决书 PNG 生成
```

## 技术栈

- 前端：HTML / CSS / JavaScript
- 后端：Node.js 原生 HTTP 服务
- 数据：本地 JSON 文件
- AI：DeepSeek API
- 图片生成：Sharp

## 启动项目

安装依赖：

```powershell
npm install
```

复制 `.env.example` 为 `.env`，并填入 DeepSeek API Key：

```text
DEEPSEEK_API_KEY=你的 DeepSeek API Key
DEEPSEEK_MODEL=deepseek-v4-flash
```

启动服务：

```powershell
npm start
```

如果没有使用 npm 脚本，也可以直接运行：

```powershell
node server.js
```

启动后访问：

```text
http://localhost:3000
```

没有配置 DeepSeek Key 时，项目仍然可以运行，会自动使用本地规则生成裁决。

## 联机试玩

1. 原告打开首页，点击“我要起诉”。
2. 填写案件名称、双方昵称和原告陈词。
3. 点击“同步陈词”。
4. 复制“传唤被告链接”发给对方。
5. 对方打开同一个链接后会自动成为被告，填写被告陈词。
6. 双方陈词完成后，点击“AI追问”或“生成裁决”。
7. 在“判决书”页面复制文案或生成 PNG。

创建案件的浏览器会被记为原告。其他手机或浏览器打开同一个案件链接时，会默认作为被告进入。

## 局域网手机测试

如果手机和电脑在同一个 Wi-Fi / 局域网，可以把链接里的 `localhost` 改成电脑的局域网 IP。

示例：

```text
http://192.168.1.90:3000
```

如果手机打不开，通常是 Windows 防火墙拦截了 Node.js，需要允许 Node.js 通过专用网络。

## API 概览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/cases` | 获取案件列表 |
| `POST` | `/api/cases` | 创建案件 |
| `GET` | `/api/cases/:id` | 获取单个案件 |
| `PATCH` | `/api/cases/:id` | 更新案件信息和陈词 |
| `POST` | `/api/cases/:id/question` | 生成 AI 追问 |
| `POST` | `/api/cases/:id/verdict` | 生成 AI 裁决 |
| `GET` | `/api/cases/:id/share-image` | 生成判决书 PNG |
| `DELETE` | `/api/cases` | 清空本地案卷 |

## AI 裁决原则

服务端会优先调用 DeepSeek 生成裁决。如果 `.env` 没有配置 key，或者接口调用失败，会自动回退到本地规则裁决。

当前裁决风格要求：

- 像一本正经的爱情法庭判决书
- 保持轻微幽默，但不羞辱任何一方
- 先承认双方感受，再指出沟通问题
- 处罚必须轻量、可执行、适合转发
- 生成一句适合截图传播的“本案金句”
- 不输出真实法律建议、心理诊断或高风险建议

## 协作流程

推荐直接基于 GitHub PR 协作：

```text
main
  |
  |-- feature/xxx
        |
        v
      Pull Request
        |
        v
      Review
        |
        v
      Merge
```

提交建议：

- 每次功能改动都更新 README 或 ROADMAP 中对应说明
- commit message 写清楚，例如 `Add shareable verdict quote`
- PR 描述写明改了什么、为什么改、如何验证
- 不要提交 `.env`、`data/`、`shots/`、`node_modules/`

## 小程序迁移计划

### 用户身份识别

微信小程序不再执行额外的 `wx.login -> code2Session -> 业务 Token`
登录流程。云函数通过 `cloud.getWXContext().OPENID` 直接识别当前微信用户，
前端无需保存 AppSecret、session key 或业务登录 Token。HTTP 本地开发兜底
仍使用匿名 `client-id` 区分浏览器实例。

当前 Web MVP 稳定后，会逐步迁移到微信小程序：

```text
Web MVP
  |
  v
miniprogram/ 小程序页面骨架
  |
  v
本地模拟数据跑通手机预览
  |
  v
接入微信云开发数据库
  |
  v
云函数调用 DeepSeek
  |
  v
生成小程序分享卡和判决书图片
```

迁移时会保留 Web 版本，避免影响当前可试玩版本。

## 文档

- [PRD.md](./PRD.md)
- [ROADMAP.md](./ROADMAP.md)
- [Love Court 项目说明书](./docs/PROJECT_OVERVIEW.md)

## 注意

不要提交 `.env`、`data/`、`shots/` 和 `node_modules/`。这些内容应保持在本地环境中。
