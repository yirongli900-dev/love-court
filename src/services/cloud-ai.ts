/**
 * 云函数 AI 调用抽象层
 *
 * 封装对 aiVerdict / aiQuestion 云函数的调用，
 * 失败时抛出明确错误，便于 courtApi 捕获并降级。
 */

import type { CourtCase, Verdict } from '@/types/court';
import { callCloudFunction } from '@/services/cloud';

// 自定义错误：云 AI 不可用
export class CloudAINotAvailableError extends Error {
  constructor(message = '云 AI 服务不可用') {
    super(message);
    this.name = 'CloudAINotAvailableError';
  }
}

interface AIVerdictResponse {
  ok: boolean;
  verdict?: Verdict;
  provider?: string;
  model?: string | null;
  error?: string;
}

interface AIQuestionResponse {
  ok: boolean;
  question?: string;
  provider?: string;
  model?: string | null;
  error?: string;
}

/**
 * 通过云函数生成 AI 裁决
 * @throws CloudAINotAvailableError 当云函数不可用或返回错误时
 */
export async function generateVerdictByCloud(caseData: CourtCase): Promise<Verdict> {
  const result = await callCloudFunction<AIVerdictResponse>('aiVerdict', { case: caseData });
  if (!result?.ok || !result.verdict) {
    throw new CloudAINotAvailableError(result?.error || '云函数未返回有效裁决');
  }
  return result.verdict;
}

/**
 * 通过云函数生成 AI 追问
 * @throws CloudAINotAvailableError 当云函数不可用或返回错误时
 */
export async function generateQuestionByCloud(caseData: CourtCase): Promise<string> {
  const result = await callCloudFunction<AIQuestionResponse>('aiQuestion', { case: caseData });
  if (!result?.ok || !result.question) {
    throw new CloudAINotAvailableError(result?.error || '云函数未返回有效追问');
  }
  return result.question;
}
