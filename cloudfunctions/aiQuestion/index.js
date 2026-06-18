// AI 追问生成云函数
// 接收案件上下文，生成 AI 追问问题
// 先尝试关键词规则匹配（节省成本），未命中时再调用 AI
const cloud = require('wx-server-sdk');
const {
  buildQuestion,
  QUESTION_PROMPT_SYSTEM,
  buildQuestionUserPrompt,
} = require('../_common/verdict-builder');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 规则匹配命中标记
function matchRuleQuestion(item) {
  const text = `${item.title || ''} ${item.plaintiffStatement || ''} ${item.defendantStatement || ''}`;
  if (/已读|不回|消息|微信|回复/.test(text)) {
    return "请双方分别说明：消息没有及时回复时，是否有提前说明忙碌状态？对方通常能接受多久不回复？";
  }
  if (/纪念日|生日|节日|礼物/.test(text)) {
    return "请双方分别说明：这个日子的重要性是否提前表达过？是否存在补救行为？";
  }
  if (/游戏|开黑|排位|电脑/.test(text)) {
    return "请双方分别说明：游戏安排是否影响了约定时间？有没有提前沟通优先级？";
  }
  if (/奶茶|外卖|吃|饭|零食/.test(text)) {
    return "请双方分别说明：这份食物原本归谁？有没有出现未经同意就处置的情况？";
  }
  return null;
}

exports.main = async (event, context) => {
  const item = event?.case;

  // 入参校验
  if (!item || !item.title) {
    return { ok: false, error: '案件信息不完整，需要 title' };
  }

  // 1. 先尝试关键词规则匹配（节省成本，不调用 AI）
  const ruleQuestion = matchRuleQuestion(item);
  if (ruleQuestion) {
    return {
      ok: true,
      question: ruleQuestion,
      provider: 'local-rules',
    };
  }

  // 2. 未命中规则，使用默认规则问题
  const defaultQuestion = buildQuestion(item);

  // 3. 检查 API Key 是否配置
  const apiKey = process.env.DEEPSEEK_API_KEY;
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

  if (!apiKey) {
    return {
      ok: true,
      question: defaultQuestion,
      provider: 'local-rules',
      model: null,
    };
  }

  // 4. 调用 AI 生成更精准的追问
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
          { role: 'system', content: QUESTION_PROMPT_SYSTEM },
          { role: 'user', content: buildQuestionUserPrompt(item) },
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
