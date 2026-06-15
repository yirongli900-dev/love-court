import Taro from '@tarojs/taro';
import type { CasePatch, CourtCase, VerdictRatio } from '@/types/court';

const API_BASE =
  typeof process !== 'undefined' && process.env && process.env.TARO_APP_API_BASE
    ? process.env.TARO_APP_API_BASE
    : 'http://127.0.0.1:3000';
const LOCAL_CASES_KEY = 'love-court-miniapp-cases';

interface ApiResponse<T> {
  case?: CourtCase;
  cases?: CourtCase[];
  error?: string;
  ok?: boolean;
}

async function request<T>(path: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET', data?: unknown): Promise<T> {
  const url = `${API_BASE}${path}`;
  console.info('[CourtAPI] request', { path, method });
  try {
    const response = await Taro.request<ApiResponse<T>>({
      url,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
      },
    });

    if (response.statusCode < 200 || response.statusCode >= 300) {
      const message = response.data?.error || '请求失败，请稍后重试';
      console.error('[CourtAPI] failed', { path, method, statusCode: response.statusCode, message });
      throw new Error(message);
    }

    return response.data as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error || {});
    console.warn('[CourtAPI] exception', { path, method, message });
    throw new Error(message || '后端服务不可达');
  }
}

function readLocalCases(): CourtCase[] {
  try {
    return Taro.getStorageSync<CourtCase[]>(LOCAL_CASES_KEY) || [];
  } catch (error) {
    console.error('[LocalCourt] read failed', error);
    return [];
  }
}

function writeLocalCases(cases: CourtCase[]) {
  Taro.setStorageSync(LOCAL_CASES_KEY, cases);
}

function updateLocalCase(caseId: string, updater: (item: CourtCase) => CourtCase) {
  const cases = readLocalCases();
  const index = cases.findIndex((item) => item.id === caseId);
  if (index < 0) throw new Error('案件不存在或已被清空');
  cases[index] = updater(cases[index]);
  writeLocalCases(cases);
  return cases[index];
}

function createLocalCase() {
  const cases = readLocalCases();
  const now = new Date().toISOString();
  const currentYear = new Date().getFullYear();
  const item: CourtCase = {
    id: `local-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    caseNumber: `${currentYear}-${String(cases.length + 1).padStart(3, '0')}`,
    inviteCode: Math.random().toString(16).slice(2, 8).toUpperCase(),
    title: '',
    plaintiffName: '',
    defendantName: '',
    plaintiffStatement: '',
    defendantStatement: '',
    plaintiffAnswer: '',
    defendantAnswer: '',
    question: '',
    verdict: null,
    createdAt: now,
    updatedAt: now,
  };
  cases.unshift(item);
  writeLocalCases(cases);
  return item;
}

function buildLocalQuestion(item: CourtCase) {
  const text = `${item.title} ${item.plaintiffStatement} ${item.defendantStatement}`;
  if (/已读|不回|消息|微信|回复/.test(text)) return '请双方分别说明：消息没有及时回复时，是否提前说明忙碌状态？';
  if (/纪念日|生日|节日|礼物/.test(text)) return '请双方分别说明：这个日子的重要性是否提前表达过？';
  if (/游戏|开黑|排位|电脑/.test(text)) return '请双方分别说明：游戏安排是否影响了约定时间？有没有提前沟通优先级？';
  if (/奶茶|外卖|吃|饭|零食/.test(text)) return '请双方分别说明：这份食物原本归谁？有没有未经同意就处置？';
  return '请双方分别说明：这件事发生前，有没有明确表达期待或提前告知安排？';
}

function scoreLocalResponsibility(item: CourtCase): VerdictRatio {
  const plaintiffText = `${item.plaintiffStatement} ${item.plaintiffAnswer}`;
  const defendantText = `${item.defendantStatement} ${item.defendantAnswer}`;
  let defendantScore = 50;
  defendantScore += (defendantText.match(/忘|没回|没看|打游戏|睡着|错了|道歉|没注意/g) || []).length * 8;
  defendantScore -= (plaintiffText.match(/翻旧账|阴阳|冷战|拉黑|试探/g) || []).length * 7;
  if (/提前|说过|约好|答应/.test(plaintiffText)) defendantScore += 12;
  if (/道歉|补偿|解释|哄/.test(defendantText)) defendantScore -= 10;
  defendantScore = Math.max(20, Math.min(85, defendantScore));
  const defendant = Math.round(defendantScore / 5) * 5;
  return { defendant, plaintiff: 100 - defendant };
}

function buildLocalVerdict(item: CourtCase) {
  const ratio = scoreLocalResponsibility(item);
  const defendantLoses = ratio.defendant >= ratio.plaintiff;
  const loser = defendantLoses ? item.defendantName : item.plaintiffName;
  const winner = defendantLoses ? item.plaintiffName : item.defendantName;
  const text = `${item.title} ${item.plaintiffStatement} ${item.defendantStatement}`;
  let penalty = `${loser || '责任较重方'}请${winner || '对方'}喝奶茶一杯，并认真道歉一次。`;
  if (/游戏|开黑|排位|电脑/.test(text)) penalty = `${loser || '责任较重方'}暂停排位一晚，安排一次完整陪伴局。`;
  if (/已读|不回|消息|微信|回复/.test(text)) penalty = `${loser || '责任较重方'}主动报备忙碌状态 24 小时，并补发一句不敷衍的想念。`;
  return {
    ratio,
    focus: ['是否提前表达期待', '是否存在失约或忽视', '事后是否主动解释和补救'],
    facts: `本案围绕“${item.title || '未命名案件'}”展开，双方均表达了情绪和期待。`,
    reason: `本地规则认为，亲密关系中的争议重点不是输赢，而是期待是否说清、承诺是否被尊重。${loser || '责任较重方'}需要承担更多安抚义务。`,
    penalty,
    indices: {
      hardMouth: Math.min(96, Math.max(38, Math.max(ratio.plaintiff, ratio.defendant) + 8)),
      grievance: /不回|冷战|已读/.test(text) ? 78 : 62,
      coaxDifficulty: Math.min(95, Math.max(35, 45 + Math.abs(ratio.plaintiff - ratio.defendant) / 2)),
      oldScoreRisk: /翻旧账|以前|每次|总是|上次/.test(text) ? 78 : 36,
    },
    settlement: '建议双方说清一个具体需求，给出一个具体补偿，然后本案封存，禁止无限上诉。',
    reasoning: [
      { step: 1, label: '关键证据', text: `原告称“${item.plaintiffStatement.slice(0, 32)}”；被告称“${item.defendantStatement.slice(0, 32)}”。` },
      { step: 2, label: '推理逻辑', text: `根据陈词关键词与补救意愿，责任比例为原告${ratio.plaintiff}%，被告${ratio.defendant}%。` },
      { step: 3, label: '适用规则', text: /游戏|开黑|排位|电脑/.test(text) ? '游戏安排变更前应提前沟通，约定优先于娱乐安排。' : '亲密关系中，表达期待和及时补救同样重要。' },
    ],
    provider: 'local-rules',
  };
}

async function withLocalFallback<T>(remoteAction: () => Promise<T>, localAction: () => T): Promise<T> {
  try {
    return await remoteAction();
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error || {});
    console.warn('[CourtAPI] fallback to local rules', message);
    return localAction();
  }
}

function isLocalCase(caseId: string) {
  return caseId.startsWith('local-');
}

function getLocalCase(caseId: string) {
  const item = readLocalCases().find((entry) => entry.id === caseId);
  if (!item) throw new Error('案件不存在或已被清空');
  return item;
}

export const courtApi = {
  createCase: () => withLocalFallback(() => request<{ case: CourtCase }>('/api/cases', 'POST'), () => ({ case: createLocalCase() })),
  getCase: (caseId: string) => {
    if (isLocalCase(caseId)) return Promise.resolve({ case: getLocalCase(caseId) });
    return withLocalFallback(() => request<{ case: CourtCase }>(`/api/cases/${encodeURIComponent(caseId)}`), () => ({ case: getLocalCase(caseId) }));
  },
  listCases: () => withLocalFallback(() => request<{ cases: CourtCase[] }>('/api/cases'), () => ({ cases: readLocalCases() })),
  updateCase: (caseId: string, patch: CasePatch) => {
    const localAction = () => ({ case: updateLocalCase(caseId, (item) => ({ ...item, ...patch, updatedAt: new Date().toISOString() })) });
    if (isLocalCase(caseId)) return Promise.resolve(localAction());
    return withLocalFallback(() => request<{ case: CourtCase }>(`/api/cases/${encodeURIComponent(caseId)}`, 'PATCH', patch), localAction);
  },
  askQuestion: (caseId: string) => {
    const localAction = () => ({ case: updateLocalCase(caseId, (item) => ({ ...item, question: buildLocalQuestion(item), updatedAt: new Date().toISOString() })) });
    if (isLocalCase(caseId)) return Promise.resolve(localAction());
    return withLocalFallback(() => request<{ case: CourtCase }>(`/api/cases/${encodeURIComponent(caseId)}/question`, 'POST'), localAction);
  },
  buildVerdict: (caseId: string) => {
    const localAction = () => ({ case: updateLocalCase(caseId, (item) => ({ ...item, verdict: buildLocalVerdict(item), updatedAt: new Date().toISOString() })) });
    if (isLocalCase(caseId)) return Promise.resolve(localAction());
    return withLocalFallback(() => request<{ case: CourtCase }>(`/api/cases/${encodeURIComponent(caseId)}/verdict`, 'POST'), localAction);
  },
};
