# _common 目录说明

此目录**不是云函数**，不会被微信开发者工具识别为可部署的云函数。

它的作用是为 `cloudfunctions/aiVerdict`、`cloudfunctions/aiQuestion` 等云函数提供共享的业务逻辑代码（裁决规则、追问规则、AI 返回校验、prompt 模板）。

## 使用方式

在云函数代码中通过相对路径引用：

```javascript
const {
  buildVerdict,
  buildQuestion,
  normalizeAiVerdict,
  VERDICT_PROMPT_SYSTEM,
  buildVerdictUserPrompt,
} = require('../_common/verdict-builder');
```

## 注意事项

**部署时需要手动将 `_common` 目录一起上传到云端**，否则云函数无法 require 共享代码。

微信开发者工具默认「上传并部署：云端安装依赖」时，会自动包含云函数目录下的所有子目录文件，因此 `_common` 需要放在引用它的云函数**同级目录**下，并通过相对路径引用。

## 文件清单

- `verdict-builder.js`：裁决与追问的共享业务逻辑
  - `buildVerdict(item)` 本地规则裁决
  - `buildQuestion(item)` 本地规则追问
  - `normalizeAiVerdict(verdict, item)` AI 返回校验
  - `VERDICT_PROMPT_SYSTEM` / `buildVerdictUserPrompt(item)` 裁决 prompt
  - `QUESTION_PROMPT_SYSTEM` / `buildQuestionUserPrompt(item)` 追问 prompt
