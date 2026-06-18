// AI 裁决生成云函数
// 接收案件上下文，调用 DeepSeek API 生成娱乐裁决
// API Key 从云函数环境变量 DEEPSEEK_API_KEY 读取（不暴露在前端）
const cloud = require('wx-server-sdk');
const fetch = require('node-fetch');
const {
  buildVerdict,
  normalizeAiVerdict,
  VERDICT_PROMPT_SYSTEM,
  buildVerdictUserPrompt,
} = require('./verdict-builder');

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

    // JSON 解析容错：AI 返回可能为空、带 Markdown 包裹、或非 JSON 字符串
    if (!content) {
      console.error('[aiVerdict] empty content from deepseek', { payload });
      return {
        ok: true,
        verdict: buildVerdict(item),
        provider: 'local-rules-fallback',
        model: null,
      };
    }

    // 去除可能的 Markdown 代码块包裹（如 ```json{...}```）
    const cleanedContent = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanedContent);
    } catch (e) {
      console.error('[aiVerdict] json parse failed', {
        message: e?.message || String(e),
        contentPreview: String(cleanedContent).slice(0, 200),
      });
      return {
        ok: true,
        verdict: buildVerdict(item),
        provider: 'local-rules-fallback',
        model: null,
      };
    }

    const normalized = normalizeAiVerdict(parsed, item);
    return {
      ok: true,
      verdict: normalized,
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
