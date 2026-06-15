import Taro from '@tarojs/taro';

const OWNED_CASES_KEY = 'love-court-owned-cases';
const CURRENT_CASE_KEY = 'love-court-current-case';

export function getOwnedCases(): string[] {
  try {
    return Taro.getStorageSync<string[]>(OWNED_CASES_KEY) || [];
  } catch (error) {
    console.error('[Storage] getOwnedCases failed', error);
    return [];
  }
}

export function rememberOwnedCase(caseId: string) {
  const ownedCases = new Set(getOwnedCases());
  ownedCases.add(caseId);
  Taro.setStorageSync(OWNED_CASES_KEY, Array.from(ownedCases));
}

export function setCurrentCaseId(caseId: string) {
  Taro.setStorageSync(CURRENT_CASE_KEY, caseId);
}

export function getCurrentCaseId() {
  return Taro.getStorageSync<string>(CURRENT_CASE_KEY) || '';
}

export function getProviderLabel(provider?: string, model?: string) {
  if (provider === 'deepseek') {
    return `本裁决由${model || 'deepseek'} AI模型生成`;
  }
  return '本裁决根据本地规则生成';
}

export function trimInput(value: string, maxLength: number) {
  return value.trim().slice(0, maxLength);
}
