# Love Court 项目说明书

AI情侣法庭是一款把情侣、朋友、室友之间的小矛盾变成“开庭审理”的 AI 娱乐产品。

它的核心价值不是判断谁绝对正确，而是把争执变成一个更轻、更好笑、更容易被双方接受的互动过程。

## 一句话

情侣吵架别冷战，来开庭。

## 产品定位

```mermaid
mindmap
  root((AI情侣法庭))
    娱乐工具
      轻量裁决
      搞笑处罚
      判决书分享
    情侣互动
      表达委屈
      听见对方
      找到台阶
    社交传播
      本案金句
      分享卡
      年度报告
    非目标
      法律咨询
      心理咨询
      危机干预
```

## 核心体验

用户应该感觉自己不是在填一份严肃表格，而是在发起一场“爱情法庭审理”。

```mermaid
flowchart TD
  A[原告点击 我要起诉] --> B[填写案由与原告陈词]
  B --> C[系统生成案件编号和邀请链接]
  C --> D[原告把链接发给被告]
  D --> E[被告打开链接并自动进入被告身份]
  E --> F[被告填写被告陈词]
  F --> G{是否需要补充事实}
  G -->|需要| H[AI 法官追问]
  H --> I[双方补充回答]
  G -->|不需要| J[生成 AI 裁决]
  I --> J
  J --> K[展示责任比例和娱乐处罚]
  K --> L[生成本案金句]
  L --> M[生成判决书分享卡]
  M --> N[复制文案或保存 PNG]
```

## 页面结构

```mermaid
flowchart LR
  App[Web App] --> Court[开庭页]
  App --> Archive[案卷页]
  App --> Share[判决书页]

  Court --> CaseInfo[案件信息]
  Court --> Statements[双方陈词]
  Court --> Question[AI 追问]
  Court --> VerdictAction[生成裁决]

  Archive --> CaseList[案件列表]
  Archive --> LoadCase[查看历史判决]

  Share --> VerdictCard[判决书正面]
  Share --> BackDetail[裁决理由背面]
  Share --> CopyText[复制文案]
  Share --> PngCard[生成 PNG]
```

## 系统架构

当前版本是 Web MVP，前后端都在一个轻量 Node.js 服务里，适合快速验证玩法。

```mermaid
flowchart TB
  UserA[原告浏览器] --> Web[HTML / CSS / JS]
  UserB[被告浏览器] --> Web

  Web --> API[Node.js server.js]

  API --> Cases[(data/cases.json)]
  API --> Rules[本地规则裁决]
  API --> DeepSeek[DeepSeek API]
  API --> Sharp[Sharp PNG 生成]

  DeepSeek --> Verdict[AI 裁决 JSON]
  Rules --> Verdict
  Verdict --> ShareCard[判决书分享卡]
  Sharp --> Image[判决书 PNG]
```

## 数据流

```mermaid
sequenceDiagram
  participant P as 原告
  participant S as 服务端
  participant D as 被告
  participant AI as DeepSeek

  P->>S: POST /api/cases 创建案件
  S-->>P: 返回案件 ID / 邀请码
  P->>D: 分享 ?case=xxx&role=defendant
  P->>S: PATCH 原告陈词
  D->>S: PATCH 被告陈词
  P->>S: POST /api/cases/:id/verdict
  S->>AI: 请求娱乐裁决
  AI-->>S: 返回责任比例 / 金句 / 处罚 / 推理步骤
  S-->>P: 返回完整案件
  D->>S: GET /api/cases/:id 轮询同步
```

## AI 裁决结构

AI 输出不是自由聊天，而是一份结构化裁决。

```mermaid
classDiagram
  class Verdict {
    ratio
    focus[]
    facts
    reason
    quote
    penalty
    indices
    settlement
    reasoning[]
    provider
  }

  class Ratio {
    plaintiff
    defendant
  }

  class Indices {
    hardMouth
    grievance
    coaxDifficulty
    oldScoreRisk
  }

  class ReasoningStep {
    step
    label
    text
  }

  Verdict --> Ratio
  Verdict --> Indices
  Verdict --> ReasoningStep
```

## 裁决风格

```mermaid
flowchart LR
  Input[双方陈词] --> Extract[提取事实与争议点]
  Extract --> Balance[承认双方感受]
  Balance --> Judge[判断责任比例]
  Judge --> Quote[生成本案金句]
  Quote --> Penalty[生成轻量处罚]
  Penalty --> Settle[给出和解动作]
```

裁决文案要求：

- 像一本正经的爱情法庭判决书
- 有轻微幽默感，但不羞辱任何一方
- 不劝分，不扩大矛盾
- 不提供法律、医疗、投资等高风险建议
- 处罚必须轻量、可执行、适合转发

## 分享卡设计

```mermaid
flowchart TD
  Card[判决书分享卡] --> Front[正面]
  Card --> Back[背面]
  Card --> Image[PNG 图片]

  Front --> CaseNo[案件编号]
  Front --> Title[案由]
  Front --> Quote[本案金句]
  Front --> Ratio[责任比例]
  Front --> Indices[娱乐指数]
  Front --> Penalty[判决结果]

  Back --> Facts[事实认定]
  Back --> Reasoning[推理步骤]
  Back --> Focus[争议焦点]
  Back --> Settlement[和解建议]

  Image --> Poster[适合转发的竖版海报]
```

## 当前文件职责

| 文件 | 职责 |
| --- | --- |
| `index.html` | 页面结构，包含开庭、案卷、判决书三个视图 |
| `styles.css` | 视觉风格、移动端布局、判决卡翻牌效果 |
| `app.js` | 前端状态、案件同步、身份识别、裁决卡渲染 |
| `server.js` | API 服务、案件存储、AI 裁决、PNG 生成 |
| `data/cases.json` | 本地案件数据，不提交到 GitHub |
| `PRD.md` | 产品需求说明 |
| `ROADMAP.md` | 版本路线图 |

## 代码逻辑映射

这张图用来帮助新加入的同学快速找到“某个功能应该看哪段代码”。

```mermaid
flowchart TB
  subgraph Frontend[前端 app.js]
    Boot[boot 初始化] --> Bind[bindEvents 绑定事件]
    Boot --> Load[loadCase / renderArchive 读取案件]
    Bind --> Create[createCase 创建案件]
    Bind --> Save[saveCurrentCase 同步陈词]
    Bind --> Ask[askQuestion 生成追问]
    Bind --> Verdict[generateVerdict 生成裁决]
    Bind --> Share[exportShareCard / showShareImage 分享]
    Load --> Hydrate[hydrateCase 回填页面]
    Hydrate --> Card[hydrateCard 渲染判决卡]
    Card --> Back[renderBackContent 渲染背面理由]
    Card --> Height[syncCardHeight 稳定翻牌高度]
    Boot --> Poll[startPolling 轮询同步]
  end

  subgraph Backend[后端 server.js]
    Router[handleApi API 分发] --> CaseAPI[案件 CRUD]
    Router --> QuestionAPI[POST question]
    Router --> VerdictAPI[POST verdict]
    Router --> ImageAPI[GET share-image]
    CaseAPI --> Store[readCases / writeCases]
    QuestionAPI --> LocalQuestion[buildQuestion]
    VerdictAPI --> Validate[validateCase]
    Validate --> AIVerdict[buildAiVerdict]
    AIVerdict --> DeepSeek[DeepSeek API]
    AIVerdict --> LocalVerdict[buildVerdict 本地兜底]
    ImageAPI --> Svg[buildShareImageSvg]
    Svg --> Png[sharp PNG]
  end

  Frontend -->|fetch| Backend
```

## 前端状态流

```mermaid
stateDiagram-v2
  [*] --> NoCase: 首次打开
  NoCase --> PlaintiffDraft: 点击 我要起诉
  PlaintiffDraft --> Synced: 同步陈词
  Synced --> WaitingDefendant: 分享链接
  WaitingDefendant --> ReadyToJudge: 被告陈词完成
  ReadyToJudge --> Questioning: AI追问
  Questioning --> ReadyToJudge: 双方补充
  ReadyToJudge --> VerdictReady: 生成裁决
  VerdictReady --> ShareFront: 判决书正面
  ShareFront --> ShareBack: 查看裁决理由
  ShareBack --> ShareFront: 返回正面
  VerdictReady --> Poster: 生成 PNG
```

## 后端 API 分发逻辑

```mermaid
flowchart TD
  Req[HTTP Request] --> Static{是否 /api 开头}
  Static -->|否| Serve[serveStatic 返回静态文件]
  Static -->|是| Api[handleApi]

  Api --> List{GET /api/cases}
  List --> ReadAll[读取案件列表]

  Api --> Create{POST /api/cases}
  Create --> NewCase[生成 id / caseNumber / inviteCode]

  Api --> Detail{GET /api/cases/:id}
  Detail --> Find[findCaseOrThrow]

  Api --> Patch{PATCH /api/cases/:id}
  Patch --> Update[updateCase 写入陈词]

  Api --> Q{POST /api/cases/:id/question}
  Q --> BuildQ[buildQuestion]

  Api --> V{POST /api/cases/:id/verdict}
  V --> Check[validateCase]
  Check --> BuildAI[buildAiVerdict]

  Api --> Img{GET /api/cases/:id/share-image}
  Img --> BuildImg[buildShareImagePng]
```

## 裁决生成链路

```mermaid
flowchart TD
  Start[generateVerdict] --> SaveDraft[先保存当前陈词]
  SaveDraft --> Server[POST /api/cases/:id/verdict]
  Server --> Validate[validateCase 校验案件]
  Validate --> HasKey{是否配置 DeepSeek Key}
  HasKey -->|否| Local[buildVerdict 本地规则]
  HasKey -->|是| Prompt[组装裁决 Prompt]
  Prompt --> Call[调用 DeepSeek]
  Call --> OK{AI 是否成功返回 JSON}
  OK -->|是| Normalize[normalizeAiVerdict 归一化]
  OK -->|否| LocalFallback[本地规则兜底]
  Normalize --> Store[写入 cases.json]
  Local --> Store
  LocalFallback --> Store
  Store --> UI[hydrateCard 渲染判决书]
```

## 判决书 PNG 生成链路

```mermaid
flowchart LR
  Button[点击 生成图片] --> Api[GET share-image]
  Api --> Case[读取案件和 verdict]
  Case --> Svg[buildShareImageSvg]
  Svg --> Layout[排版标题/金句/责任/指数/处罚]
  Layout --> Sharp[sharp 转 PNG]
  Sharp --> Preview[前端预览图片]
  Preview --> Download[下载/保存]
```

## 协作方式

```mermaid
gitGraph
  commit id: "main"
  branch feature
  checkout feature
  commit id: "实现功能"
  commit id: "更新文档"
  checkout main
  merge feature id: "PR 合入"
  commit id: "继续迭代"
```

推荐规则：

- 小步提交，每次改动目标明确
- 功能改动同步更新 README 或 ROADMAP
- PR 描述写清楚“改了什么、为什么改、怎么验证”
- 不提交 `.env`、`data/`、`shots/`、`node_modules/`

## 小程序迁移路线

```mermaid
flowchart TD
  A[Web MVP 稳定核心玩法] --> B[新增 miniprogram 小程序目录]
  B --> C[迁移开庭页 / 案卷页 / 判决书页]
  C --> D[使用本地 mock 数据跑通手机预览]
  D --> E[接入微信云开发数据库]
  E --> F[云函数调用 DeepSeek]
  F --> G[生成小程序分享卡]
  G --> H[真机测试与体验打磨]
  H --> I[准备审核材料]
```

迁移原则：

- Web 版本继续保留，作为快速验证和调试入口
- 小程序先做预览版，不急着上线
- 先跑通核心链路，再处理登录、云数据库、审核材料

## 下一步优化方向

```mermaid
quadrantChart
  title 优化优先级
  x-axis 低传播价值 --> 高传播价值
  y-axis 低实现成本 --> 高实现成本
  quadrant-1 优先打磨
  quadrant-2 规划推进
  quadrant-3 暂缓
  quadrant-4 快速补齐
  判决书分享卡: [0.88, 0.35]
  手机端适配: [0.76, 0.42]
  小程序预览版: [0.72, 0.72]
  年度报告: [0.9, 0.86]
  AI律师: [0.58, 0.76]
  反馈模板: [0.52, 0.22]
```

当前最值得继续做的两件事：

1. 打磨手机端判决书体验，让截图更像能分享的内容。
2. 新增小程序预览版骨架，为微信真机测试做准备。
