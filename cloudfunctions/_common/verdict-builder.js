/**
 * 裁决生成与校验共享模块
 *
 * 从原 server.js 抽取，供 aiVerdict / aiQuestion 云函数复用。
 * 包含：
 *  - 本地规则裁决：buildVerdict / scoreResponsibility / buildCaseQuote / buildFunIndices / buildLocalReasoning
 *  - 本地规则追问：buildQuestion
 *  - AI 返回校验：normalizeAiVerdict / normalizeIndices / normalizeQuote / normalizeReasoning
 *  - Prompt 模板：VERDICT_PROMPT_SYSTEM / VERDICT_PROMPT_USER_TEMPLATE
 */

function scoreResponsibility(item) {
  const plaintiffText = `${item.plaintiffStatement} ${item.plaintiffAnswer}`;
  const defendantText = `${item.defendantStatement} ${item.defendantAnswer}`;
  let defendantScore = 50;
  const defendantBad = /忘|没回|没看|打游戏|睡着|下次|错了|道歉|没注意|太忙|加班|迟到/g;
  const plaintiffBad = /翻旧账|阴阳|冷战|拉黑|生气但没说|不告诉|故意|试探/g;
  defendantScore += (defendantText.match(defendantBad) || []).length * 8;
  defendantScore -= (plaintiffText.match(plaintiffBad) || []).length * 7;
  if (/提前|说过|约好|答应/.test(plaintiffText)) defendantScore += 12;
  if (/不知道|没说|没提醒|临时/.test(defendantText)) defendantScore -= 8;
  if (/道歉|补偿|解释|哄/.test(defendantText)) defendantScore -= 10;
  if (/冷战|不理|拉黑/.test(plaintiffText)) defendantScore -= 8;
  defendantScore = Math.max(20, Math.min(85, defendantScore));
  const defendant = Math.round(defendantScore / 5) * 5;
  return { defendant, plaintiff: 100 - defendant };
}

function buildCaseQuote(item, ratio) {
  const text = `${item.title} ${item.plaintiffStatement} ${item.defendantStatement}`;
  if (/已读|不回|消息|微信|回复/.test(text)) {
    return "本案提醒：已读不是传送门，回复才是安全出口。";
  }
  if (/纪念日|生日|节日|礼物/.test(text)) {
    return "本案提醒：重要日子可以补救，但不能靠对方破案。";
  }
  if (/游戏|开黑|排位|电脑/.test(text)) {
    return "本案提醒：排位可以重开，陪伴掉线要及时重连。";
  }
  if (/奶茶|外卖|吃|饭|零食/.test(text)) {
    return "本案提醒：食物归属权，也是亲密关系基本法。";
  }
  if (Math.abs(ratio.defendant - ratio.plaintiff) <= 10) {
    return "本案提醒：输赢先放一边，台阶要成双成对。";
  }
  return "本案提醒：小事不小，重视感要及时送达。";
}

function buildFunIndices(item, ratio) {
  const text = `${item.title} ${item.plaintiffStatement} ${item.defendantStatement} ${item.plaintiffAnswer} ${item.defendantAnswer}`;
  const maxResponsibility = Math.max(ratio.plaintiff, ratio.defendant);
  const hasOldScore = /翻旧账|以前|每次|总是|又|上次/.test(text);
  const hasSilent = /不回|冷战|不理|拉黑|已读/.test(text);
  const hasApology = /道歉|补偿|哄|解释|愿意/.test(text);
  return {
    hardMouth: Math.min(96, Math.max(38, maxResponsibility + (hasApology ? -8 : 12))),
    grievance: Math.min(98, Math.max(45, 55 + (hasSilent ? 22 : 8) + (hasOldScore ? 8 : 0))),
    coaxDifficulty: Math.min(95, Math.max(35, 45 + Math.abs(ratio.plaintiff - ratio.defendant) / 2 + (hasApology ? -6 : 12))),
    oldScoreRisk: Math.min(92, Math.max(25, hasOldScore ? 78 : hasSilent ? 48 : 36)),
  };
}

function buildLocalReasoning(item, ratio) {
  const text = `${item.title} ${item.plaintiffStatement} ${item.defendantStatement}`;
  const plaintiffText = `${item.plaintiffStatement} ${item.plaintiffAnswer}`;
  const defendantText = `${item.defendantStatement} ${item.defendantAnswer}`;
  const steps = [];

  const evidence = [];
  if (item.plaintiffStatement) evidence.push(`原告称"${item.plaintiffStatement.slice(0, 40)}"`);
  if (item.defendantStatement) evidence.push(`被告称"${item.defendantStatement.slice(0, 40)}"`);
  steps.push({ step: 1, label: "关键证据", text: evidence.join("；") || "双方陈述已记录。" });

  const logicParts = [];
  if (/忘|没回|没看|打游戏|睡着/.test(defendantText)) logicParts.push("被告存在忽视行为");
  if (/翻旧账|阴阳|冷战|拉黑/.test(plaintiffText)) logicParts.push("原告存在扩大化行为");
  if (/提前|说过|约好|答应/.test(plaintiffText)) logicParts.push("原告曾提前表达期待");
  if (/道歉|补偿|解释|哄/.test(defendantText)) logicParts.push("被告有补救意愿");
  if (!logicParts.length) logicParts.push("双方均有情绪表达，核心在于期待是否被说清");
  steps.push({ step: 2, label: "推理逻辑", text: logicParts.join("，") + `。责任比例：原告${ratio.plaintiff}%，被告${ratio.defendant}%。` });

  let rule = "亲密关系中，小事背后的重视感比事件本身更重要。";
  if (/已读|不回|消息|微信|回复/.test(text)) rule = "及时回复是基本尊重，忙碌时应主动报备状态。";
  else if (/纪念日|生日|节日|礼物/.test(text)) rule = "重要日子需要被记住，遗忘时应主动补救。";
  else if (/游戏|开黑|排位|电脑/.test(text)) rule = "约定时间优先于娱乐安排，变更需提前沟通。";
  else if (/奶茶|外卖|吃|饭|零食/.test(text)) rule = "食物归属权应被尊重，未经同意不应处置。";
  steps.push({ step: 3, label: "适用规则", text: rule });

  return steps;
}

function buildVerdict(item) {
  const ratio = scoreResponsibility(item);
  const text = `${item.title} ${item.plaintiffStatement} ${item.defendantStatement}`;
  const defendantLoses = ratio.defendant >= ratio.plaintiff;
  const loser = defendantLoses ? item.defendantName : item.plaintiffName;
  const winner = defendantLoses ? item.plaintiffName : item.defendantName;
  let penalty = `本庭判决：${loser}向${winner}赔付奶茶一杯，并提交不少于三句的真诚道歉陈述。`;
  if (/已读|不回|消息|微信|回复/.test(text)) penalty = `本庭判决：${loser}执行“消息不失踪”观察期 24 小时，并补发一句不敷衍的想念。`;
  if (/纪念日|生日|节日|礼物/.test(text)) penalty = `${loser}补办一次小型仪式，预算不低于一杯奶茶加一朵花。`;
  if (/游戏|开黑|排位|电脑/.test(text)) penalty = `本庭判决：${loser}暂停排位一晚，改开一局认真陪伴局。`;
  if (/奶茶|外卖|吃|饭|零食/.test(text)) penalty = `本庭判决：${loser}赔偿同款食物一份，并学习“入口之前先确认归属权”。`;
  if (Math.abs(ratio.defendant - ratio.plaintiff) <= 10) penalty = "双方各退一步：一人道歉一句，一人停止翻旧账 24 小时。";
  const quote = buildCaseQuote(item, ratio);
  return {
    ratio,
    focus: ["期待是否提前表达清楚", "承诺是否被认真执行", "事后是否及时解释和安抚"],
    facts: `本庭查明，本案案由为“${item.title}”。双方争议表面看是小事，实质是重视感、边界感与沟通时机的联合罢工。`,
    reason: `本庭认为，${loser}在本案中更应承担安抚与补救义务；${winner}虽有委屈，但也应避免把本案升级为历史连续剧。`,
    quote,
    penalty,
    indices: buildFunIndices(item, ratio),
    settlement: "判决生效后，请双方完成一次不翻旧账沟通：一个人说明需求，一个人给出补偿，本案当晚封存。",
    reasoning: buildLocalReasoning(item, ratio),
  };
}

function buildQuestion(item) {
  const text = `${item.title} ${item.plaintiffStatement} ${item.defendantStatement}`;
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
  return "请双方分别说明：这件事发生前，有没有明确表达期待或提前告知安排？";
}

function normalizeIndices(indices, fallback) {
  const keys = ["hardMouth", "grievance", "coaxDifficulty", "oldScoreRisk"];
  const normalized = {};
  for (const key of keys) {
    const value = Math.round(Number(indices?.[key]));
    normalized[key] = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback[key];
  }
  return normalized;
}

function normalizeQuote(input, fallback) {
  const quote = String(input || "").trim().slice(0, 80);
  if (!quote) return fallback;
  if (/破碎|崩溃|完了|分手|没救|绝望|毁了/.test(quote)) return fallback;
  return quote;
}

function normalizeReasoning(input, fallback) {
  if (!Array.isArray(input) || !input.length) return fallback;
  return input.slice(0, 6).map((item, i) => ({
    step: Number.isFinite(Number(item?.step)) ? Number(item.step) : i + 1,
    label: String(item?.label || `步骤${i + 1}`).slice(0, 20),
    text: String(item?.text || "").slice(0, 200),
  })).filter((item) => item.text);
}

function normalizeAiVerdict(verdict, item) {
  const plaintiff = Number(verdict?.ratio?.plaintiff);
  const defendant = Number(verdict?.ratio?.defendant);
  const validRatio = Number.isFinite(plaintiff) && Number.isFinite(defendant) && plaintiff + defendant === 100;
  const fallback = buildVerdict(item);
  return {
    ratio: validRatio ? { plaintiff, defendant } : fallback.ratio,
    focus: Array.isArray(verdict?.focus) && verdict.focus.length ? verdict.focus.slice(0, 3).map(String) : fallback.focus,
    facts: String(verdict?.facts || fallback.facts).slice(0, 180),
    reason: String(verdict?.reason || fallback.reason).slice(0, 240),
    quote: normalizeQuote(verdict?.quote, fallback.quote),
    penalty: String(verdict?.penalty || fallback.penalty).slice(0, 140),
    indices: normalizeIndices(verdict?.indices, fallback.indices),
    settlement: String(verdict?.settlement || fallback.settlement).slice(0, 180),
    reasoning: normalizeReasoning(verdict?.reasoning, fallback.reasoning),
  };
}

// ============ Prompt 模板（与 server.js 保持完全一致）============

const VERDICT_PROMPT_SYSTEM = [
  "你是 AI情侣法庭的娱乐法官，只处理情侣、朋友、室友之间的轻量互动争议。",
  "你的目标不是严肃判案，而是把争执包装成一份有仪式感、可转发、会让双方愿意笑一下的娱乐裁决。",
  "语言风格：像一本正经的爱情法庭判决书，轻微幽默，短句有梗，但不要油腻、不要阴阳怪气、不要羞辱任何一方。",
  "判决逻辑：先承认双方感受，再指出关键沟通问题，最后给出可执行的轻量处罚和和解动作。",
  "禁止提供法律咨询、医疗建议、投资建议、危机干预、代码生成或泛闲聊。",
  "只输出合法 JSON，不要使用 Markdown，不要添加解释性前后缀。",
].join("\n");

function buildVerdictUserPrompt(item) {
  const prompt = {
    caseNumber: item.caseNumber,
    title: item.title,
    plaintiffName: item.plaintiffName,
    defendantName: item.defendantName,
    plaintiffStatement: item.plaintiffStatement,
    defendantStatement: item.defendantStatement,
    plaintiffAnswer: item.plaintiffAnswer,
    defendantAnswer: item.defendantAnswer,
    judgeQuestion: item.question,
  };

  return [
    "请基于以下案件生成娱乐裁决。",
    "JSON 格式必须完全符合：",
    '{"ratio":{"plaintiff":数字,"defendant":数字},"focus":["争议焦点1","争议焦点2","争议焦点3"],"facts":"事实认定，80字内","reason":"判决理由，120字内","quote":"本案金句，28字内","penalty":"娱乐处罚，60字内","indices":{"hardMouth":数字,"grievance":数字,"coaxDifficulty":数字,"oldScoreRisk":数字},"settlement":"和解建议，80字内","reasoning":[{"step":1,"label":"关键证据","text":"引用双方陈词中的关键事实，50字内"},{"step":2,"label":"推理逻辑","text":"说明责任划分的推理过程，80字内"},{"step":3,"label":"适用规则","text":"说明判罚依据的情侣相处规则，60字内"}]}',
    "责任比例相加必须等于100，单方责任不要低于15或高于85。",
    "indices 四项范围必须是 0 到 100 的整数，分别代表嘴硬指数、委屈指数、哄人难度、翻旧账风险。",
    "reasoning 是 3 到 5 个推理步骤的数组，每步包含 step（序号）、label（步骤标签）、text（说明文字，80字内）。用用户易于理解的语言，避免技术术语。",
    "facts 要像“本庭查明”，reason 要像“本庭认为”，penalty 要像“本庭判决”。",
    "quote 是最适合截图传播的一句金句，要短、好记、有轻微幽默感，但不能嘲讽任何一方，也不要使用破碎、崩溃、完了、分手等扩大矛盾的词。",
    "不要输出心理诊断，不要劝分，不要扩大矛盾，不要使用法律术语冒充真实法律结论。",
    "优先生成适合截图传播的句子，避免长段说教。",
    "娱乐处罚可以是奶茶、道歉、拥抱、暂停翻旧账、陪伴等轻量动作。",
    JSON.stringify(prompt),
  ].join("\n");
}

const QUESTION_PROMPT_SYSTEM = [
  "你是 AI情侣法庭的调解员，针对情侣/朋友之间的轻量互动争议，生成一个让双方反思的追问。",
  "追问要短、温和、不指责，聚焦在「期待是否被说清」或「承诺是否被认真执行」。",
  "只输出一句问题，不要解释，不要使用 Markdown。",
].join("\n");

function buildQuestionUserPrompt(item) {
  return [
    `案件：${item.title}`,
    `原告${item.plaintiffName}陈述：${item.plaintiffStatement || "（暂无）"}`,
    `被告${item.defendantName}陈述：${item.defendantStatement || "（暂无）"}`,
    "请生成一句让双方分别反思的追问（30字内）：",
  ].join("\n");
}

module.exports = {
  scoreResponsibility,
  buildCaseQuote,
  buildFunIndices,
  buildLocalReasoning,
  buildVerdict,
  buildQuestion,
  normalizeIndices,
  normalizeQuote,
  normalizeReasoning,
  normalizeAiVerdict,
  VERDICT_PROMPT_SYSTEM,
  buildVerdictUserPrompt,
  QUESTION_PROMPT_SYSTEM,
  buildQuestionUserPrompt,
};
