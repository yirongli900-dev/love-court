export interface VerdictReasoningItem {
  step?: number;
  label: string;
  text: string;
}

export interface VerdictIndexes {
  hardMouth: number;
  grievance: number;
  coaxDifficulty: number;
  oldScoreRisk: number;
}

export interface VerdictRatio {
  plaintiff: number;
  defendant: number;
}

export interface Verdict {
  ratio: VerdictRatio;
  facts: string;
  focus: string[];
  reason: string;
  penalty: string;
  indices: VerdictIndexes;
  settlement: string;
  provider: string;
  model?: string;
  reasoning?: VerdictReasoningItem[];
}

export interface CourtCase {
  id: string;
  caseNumber: string;
  inviteCode: string;
  title: string;
  plaintiffName: string;
  defendantName: string;
  plaintiffStatement: string;
  defendantStatement: string;
  plaintiffAnswer: string;
  defendantAnswer: string;
  question: string;
  verdict: Verdict | null;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'plaintiff' | 'defendant';

export interface CasePatch {
  title?: string;
  plaintiffName?: string;
  defendantName?: string;
  plaintiffStatement?: string;
  defendantStatement?: string;
  plaintiffAnswer?: string;
  defendantAnswer?: string;
}
