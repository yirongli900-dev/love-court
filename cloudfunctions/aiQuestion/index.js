// AI 追问生成云函数
// 接收案件上下文，生成 AI 追问问题
// 策略：规则匹配提供方向 → AI 在规则基础上做个性化优化（平衡成本与体验）
const cloud = require('wx-server-sdk');
const fetch = require('node-fetch');
const {
  buildQuestion,
  QUESTION_PROMPT_SYSTEM,
  buildQuestionUserPrompt,
} = require('./verdict-builder');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 规则匹配：确定问题方向（用于引导 AI，不直接返回）
function matchRuleQuestion(item) {
  const text = `${item.title || ''} ${item.plaintiffStatement || ''} ${item.defendantStatement || ''}`;
  if (/已读|不回|消息|微信|回复/.test(text)) {
    return {
      direction: '消息回复',
      hint: '请围绕「消息回复的预期」和「忙碌时的报备习惯」展开追问',
    };
  }
  if (/纪念日|生日|节日|礼物/.test(text)) {
    return {
      direction: '重要日子',
      hint: '请围绕「重要日子的预期表达」和「遗忘后的补救行为」展开追问',
    };
  }
  if (/游戏|开黑|排位|电脑/.test(text)) {
    return {
      direction: '游戏与约定',
      hint: '请围绕「游戏与约定时间的冲突」和「优先级沟通」展开追问',
    };
  }
  if (/奶茶|外卖|吃|饭|零食/.test(text)) {
    return {
      direction: '食物归属',
      hint: '请围绕「食物归属权」和「未经同意处置」展开追问',
    };
  }
  return null;
}

function buildOptimizedPrompt(item, rule) {
  const ruleHint = rule ? `\n[规则提示] ${rule.hint}` : '';
  return [
    `案件：${item.title}`,
    `原告${item.plaintiffName || ''}陈述：${item.plaintiffStatement || '（暂无）'}`,
    `被告${item.defendantName || ''}陈述：${item.defendantStatement || '（暂无）'}`,
    ruleHint,
    '请基于以上案件，生成一句让双方分别反思的追问（30字内），要求：',
    '1. 聚焦本案最核心的争议点',
    '2. 避免指责，温和引导反思',
    '3. 只输出一句问题，不要解释，不要使用 Markdown',
  ].join('\n');
}

exports.main = async (event, context) => {
  const item = event?.case;

  // 入参校验
  if (!item || !item.title) {
    return { ok: false, error: '案件信息不完整，需要 title' };
  }

  // 1. 先做规则匹配，获取问题方向（不直接返回）
  const rule = matchRuleQuestion(item);
  const defaultQuestion = buildQuestion(item);

  // 2. 检查 API Key 是否配置
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

  // API Key 未配置：返回规则兜底问题
  if (!apiKey) {
    return {
      ok: true,
      question: defaultQuestion,
      provider: 'local-rules',
      model: null,
    };
  }

  // 3. 调用 AI 基于规则方向做个性化优化
  try {
    const userPrompt = buildOptimizedPrompt(item, rule);
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: QUESTION_PROMPT_SYSTEM },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8,
        stream: false,
        max_tokens: 80,
      }),
    });

    if (!response.ok) {
      console.error('[aiQuestion] deepseek failed', {
        status: response.status,
      });
      return {
        ok: true,
        question: defaultQuestion,
        provider: 'local-rules-fallback',
        model: null,
      };
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content?.trim();
    const question = content ? String(content).slice(0, 100) : defaultQuestion;

    return {
      ok: true,
      question,
      provider: 'deepseek',
      model,
      ruleMatched: Boolean(rule),
      ruleDirection: rule?.direction || null,
    };
  } catch (error) {
    console.error('[aiQuestion] error', error?.message || error);
    return {
      ok: true,
      question: defaultQuestion,
      provider: 'local-rules-fallback',
      model: null,
    };
  }
};
