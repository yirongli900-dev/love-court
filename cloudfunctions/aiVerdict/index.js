// AI 裁决生成云函数
// 接收案件上下文，调用 DeepSeek API 生成娱乐裁决
// API Key 从云函数环境变量 DEEPSEEK_API_KEY 读取（不暴露在前端）
const cloud = require('wx-server-sdk');
const {
  buildVerdict,
  normalizeAiVerdict,
  VERDICT_PROMPT_SYSTEM,
  buildVerdictUserPrompt,
} = require('../_common/verdict-builder');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const item = event?.case;

  // 入参校验
  if (!item || !item.title || !item.plaintiffStatement || !item.defendantStatement) {
    return { ok: false, error: '案件信息不完整，需要 title / plaintiffStatement / defendantStatement' };
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

  // API Key 未配置：返回本地规则裁决
  if (!apiKey) {
    return {
      ok: true,
      verdict: buildVerdict(item),
      provider: 'local-rules',
      model: null,
    };
  }

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: VERDICT_PROMPT_SYSTEM },
          { role: 'user', content: buildVerdictUserPrompt(item) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.9,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[aiVerdict] deepseek failed', {
        status: response.status,
        body: String(errorText || '').slice(0, 300),
      });
      return {
        ok: true,
        verdict: buildVerdict(item),
        provider: 'local-rules-fallback',
        model: null,
      };
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    const parsed = normalizeAiVerdict(JSON.parse(content), item);
    return {
      ok: true,
      verdict: parsed,
      provider: 'deepseek',
      model,
    };
  } catch (error) {
    console.error('[aiVerdict] error', error?.message || error);
    return {
      ok: true,
      verdict: buildVerdict(item),
      provider: 'local-rules-fallback',
      model: null,
    };
  }
};
