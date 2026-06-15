import React, { useMemo, useState } from 'react';
import { Button, Input, Text, Textarea, View } from '@tarojs/components';
import Taro, { useDidShow, useLoad, useShareAppMessage } from '@tarojs/taro';
import { courtApi } from '@/services/court';
import type { CasePatch, CourtCase, UserRole } from '@/types/court';
import { getCurrentCaseId, getProviderLabel, rememberOwnedCase, setCurrentCaseId, trimInput } from '@/utils/court';
import styles from './index.module.scss';

const emptyCase: CourtCase = {
  id: '',
  caseNumber: '--',
  inviteCode: '--',
  title: '',
  plaintiffName: '',
  defendantName: '',
  plaintiffStatement: '',
  defendantStatement: '',
  plaintiffAnswer: '',
  defendantAnswer: '',
  question: '',
  verdict: null,
  createdAt: '',
  updatedAt: '',
};

const IndexPage: React.FC = () => {
  const [caseData, setCaseData] = useState<CourtCase>(emptyCase);
  const [role, setRole] = useState<UserRole>('plaintiff');
  const [loading, setLoading] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const canVerdict = useMemo(() => {
    return Boolean(
      caseData.title &&
        caseData.plaintiffName &&
        caseData.defendantName &&
        caseData.plaintiffStatement.trim().length >= 8 &&
        caseData.defendantStatement.trim().length >= 8,
    );
  }, [caseData]);

  const progressText = useMemo(() => {
    if (!caseData.id) return '正在创建案件房间';
    if (caseData.verdict) return '已宣判，可查看裁决书正反面';
    if (!caseData.title || !caseData.plaintiffName || !caseData.defendantName) return '请先补全案由和双方昵称';
    if (caseData.plaintiffStatement.trim().length < 8) return '等待原告陈词，至少 8 个字';
    if (caseData.defendantStatement.trim().length < 8) return '等待被告陈词，至少 8 个字';
    return '双方陈词已齐，可以追问或宣判';
  }, [caseData]);

  useLoad((options) => {
    const sharedCaseId = typeof options.case === 'string' ? options.case : '';
    const sharedRole = options.role === 'defendant' ? 'defendant' : 'plaintiff';
    if (sharedCaseId) {
      setRole(sharedRole);
      setCurrentCaseId(sharedCaseId);
      loadCase(sharedCaseId);
    }
  });

  useDidShow(() => {
    const currentCaseId = getCurrentCaseId();
    if (currentCaseId) {
      loadCase(currentCaseId);
      return;
    }
    createCase();
  });

  useShareAppMessage(() => ({
    title: `邀请你出庭：${caseData.title || '情侣法庭'}`,
    path: `/pages/index/index?case=${caseData.id}&role=defendant`,
  }));

  const patchCase = (patch: CasePatch) => {
    setCaseData((prev) => ({ ...prev, ...patch }));
  };

  const loadCase = async (caseId: string) => {
    if (!caseId) return;
    try {
      const payload = await courtApi.getCase(caseId);
      setCaseData(payload.case);
      setCurrentCaseId(payload.case.id);
      setFlipped(false);
    } catch (error) {
      console.error('[CourtPage] loadCase failed', error);
      Taro.showToast({ title: '案件加载失败', icon: 'none' });
    }
  };

  const createCase = async () => {
    setLoading(true);
    try {
      const payload = await courtApi.createCase();
      setCaseData(payload.case);
      setRole('plaintiff');
      rememberOwnedCase(payload.case.id);
      setCurrentCaseId(payload.case.id);
      setFlipped(false);
    } catch (error) {
      console.error('[CourtPage] createCase failed', error);
      Taro.showToast({ title: '创建失败，请确认后端服务', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  const saveCase = async (quiet = false) => {
    if (!caseData.id) return;
    setLoading(true);
    const patch: CasePatch =
      role === 'plaintiff'
        ? {
            title: trimInput(caseData.title, 220),
            plaintiffName: trimInput(caseData.plaintiffName, 220),
            defendantName: trimInput(caseData.defendantName, 220),
            plaintiffStatement: trimInput(caseData.plaintiffStatement, 500),
            plaintiffAnswer: trimInput(caseData.plaintiffAnswer, 220),
          }
        : {
            defendantStatement: trimInput(caseData.defendantStatement, 500),
            defendantAnswer: trimInput(caseData.defendantAnswer, 220),
          };
    try {
      const payload = await courtApi.updateCase(caseData.id, patch);
      setCaseData(payload.case);
      if (!quiet) Taro.showToast({ title: '已同步', icon: 'success' });
    } catch (error) {
      console.error('[CourtPage] saveCase failed', error);
      Taro.showToast({ title: '同步失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  const askQuestion = async () => {
    await saveCase(true);
    setLoading(true);
    try {
      const payload = await courtApi.askQuestion(caseData.id);
      setCaseData(payload.case);
      Taro.showToast({ title: 'AI法官已追问', icon: 'success' });
    } catch (error) {
      console.error('[CourtPage] askQuestion failed', error);
      Taro.showToast({ title: '追问失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  const buildVerdict = async () => {
    await saveCase(true);
    setLoading(true);
    try {
      const payload = await courtApi.buildVerdict(caseData.id);
      setCaseData(payload.case);
      setFlipped(false);
      Taro.showToast({ title: '已宣判', icon: 'success' });
    } catch (error) {
      console.error('[CourtPage] buildVerdict failed', error);
      Taro.showToast({ title: '宣判失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  const copyInvite = async () => {
    const path = `/pages/index/index?case=${caseData.id}&role=defendant`;
    await Taro.setClipboardData({ data: path });
  };

  const goShare = () => {
    setCurrentCaseId(caseData.id);
    Taro.switchTab({ url: '/pages/share/index' });
  };

  const verdict = caseData.verdict;
  const frontClassName = flipped ? `${styles.verdictCard} ${styles.flipped}` : styles.verdictCard;

  return (
    <View className={styles.container}>
      <View className={styles.hero}>
        <Text className={styles.badge}>AI 情侣法庭</Text>
        <Text className={styles.title}>开庭，别冷战</Text>
        <Text className={styles.desc}>双方陈词后生成娱乐裁决，正面看结果，背面看理由。</Text>
      </View>

      <View className={styles.statusCard}>
        <Text className={styles.caseNo}>{caseData.caseNumber}号案件</Text>
        <Text className={styles.status}>{progressText}</Text>
        <View className={styles.roleRow}>
          <View className={role === 'plaintiff' ? styles.roleActive : styles.roleButton} onClick={() => setRole('plaintiff')}>
            <Text>原告</Text>
          </View>
          <View className={role === 'defendant' ? styles.roleActive : styles.roleButton} onClick={() => setRole('defendant')}>
            <Text>被告</Text>
          </View>
        </View>
      </View>

      <View className={styles.formCard}>
        <Text className={styles.sectionTitle}>案件信息</Text>
        <Input className={styles.input} disabled={role !== 'plaintiff'} placeholder="案由，例如：打游戏互相抱怨案" value={caseData.title} onInput={(event) => patchCase({ title: event.detail.value })} />
        <Input className={styles.input} disabled={role !== 'plaintiff'} placeholder="原告昵称" value={caseData.plaintiffName} onInput={(event) => patchCase({ plaintiffName: event.detail.value })} />
        <Input className={styles.input} disabled={role !== 'plaintiff'} placeholder="被告昵称" value={caseData.defendantName} onInput={(event) => patchCase({ defendantName: event.detail.value })} />
      </View>

      <View className={styles.formCard}>
        <Text className={styles.sectionTitle}>双方陈词</Text>
        <Textarea className={styles.textarea} disabled={role !== 'plaintiff'} maxlength={500} placeholder="原告陈词，至少 8 个字" value={caseData.plaintiffStatement} onInput={(event) => patchCase({ plaintiffStatement: event.detail.value })} />
        <Textarea className={styles.textarea} disabled={role !== 'defendant'} maxlength={500} placeholder="被告陈词，至少 8 个字" value={caseData.defendantStatement} onInput={(event) => patchCase({ defendantStatement: event.detail.value })} />
      </View>

      {caseData.question ? (
        <View className={styles.questionCard}>
          <Text className={styles.sectionTitle}>法官追问</Text>
          <Text className={styles.questionText}>{caseData.question}</Text>
          <Textarea className={styles.textarea} disabled={role !== 'plaintiff'} maxlength={220} placeholder="原告补充回答" value={caseData.plaintiffAnswer} onInput={(event) => patchCase({ plaintiffAnswer: event.detail.value })} />
          <Textarea className={styles.textarea} disabled={role !== 'defendant'} maxlength={220} placeholder="被告补充回答" value={caseData.defendantAnswer} onInput={(event) => patchCase({ defendantAnswer: event.detail.value })} />
        </View>
      ) : null}

      <View className={styles.actionGrid}>
        <Button className={styles.secondaryButton} hoverClass="none" loading={loading} onClick={() => saveCase(false)}>
          <View className={styles.buttonInner}>
            <Text className={styles.secondaryButtonText}>同步陈词</Text>
          </View>
        </Button>
        <Button className={styles.secondaryButton} hoverClass="none" disabled={!canVerdict || loading} onClick={askQuestion}>
          <View className={styles.buttonInner}>
            <Text className={styles.secondaryButtonText}>AI追问</Text>
          </View>
        </Button>
        <Button className={styles.primaryButton} hoverClass="none" disabled={!canVerdict || loading} loading={loading} onClick={buildVerdict}>
          <View className={styles.buttonInner}>
            <Text className={styles.primaryButtonText}>生成裁决</Text>
          </View>
        </Button>
        <Button className={styles.secondaryButton} hoverClass="none" openType="share" disabled={!caseData.id}>
          <View className={styles.buttonInner}>
            <Text className={styles.secondaryButtonText}>邀请被告</Text>
          </View>
        </Button>
        <Button className={styles.secondaryButton} hoverClass="none" disabled={!caseData.id} onClick={copyInvite}>
          <View className={styles.buttonInner}>
            <Text className={styles.secondaryButtonText}>复制路径</Text>
          </View>
        </Button>
        <Button className={styles.secondaryButton} hoverClass="none" onClick={createCase}>
          <View className={styles.buttonInner}>
            <Text className={styles.secondaryButtonText}>新案件</Text>
          </View>
        </Button>
      </View>

      <View className={frontClassName}>
        <View className={styles.cardFaceFront}>
          <Text className={styles.verdictTitle}>裁决书正面</Text>
          <Text className={styles.verdictCase}>{caseData.title || '等待案由'}</Text>
          {verdict ? (
            <View>
              <Text className={styles.ratio}>{caseData.plaintiffName} {verdict.ratio.plaintiff}% / {caseData.defendantName} {verdict.ratio.defendant}%</Text>
              <Text className={styles.reason}>{verdict.reason}</Text>
              <Text className={styles.penalty}>{verdict.penalty}</Text>
              <Text className={styles.provider}>{getProviderLabel(verdict.provider, verdict.model)}</Text>
              <View className={styles.verdictActions}>
                <Button className={styles.primaryButtonSmall} hoverClass="none" onClick={() => setFlipped(true)}>
                  <View className={styles.buttonInner}>
                    <Text className={styles.primaryButtonText}>查看裁决理由</Text>
                  </View>
                </Button>
                <Button className={styles.secondaryButtonSmall} hoverClass="none" onClick={goShare}>
                  <View className={styles.buttonInner}>
                    <Text className={styles.secondaryButtonText}>分享裁决</Text>
                  </View>
                </Button>
              </View>
            </View>
          ) : (
            <Text className={styles.reason}>双方陈词同步完成后，这里会生成责任比例、处罚和来源说明。</Text>
          )}
        </View>

        {verdict ? (
          <View className={styles.cardFaceBack}>
            <Text className={styles.verdictTitle}>裁决书背面</Text>
            <Text className={styles.backSubtitle}>事实认定</Text>
            <Text className={styles.backText}>{verdict.facts}</Text>
            <Text className={styles.backSubtitle}>推理步骤</Text>
            {(verdict.reasoning || []).map((item) => (
              <View key={`${item.step || item.label}`} className={styles.reasonStep}>
                <Text className={styles.stepTitle}>{item.step || ''}. {item.label}</Text>
                <Text className={styles.backText}>{item.text}</Text>
              </View>
            ))}
            <Text className={styles.backSubtitle}>适用规则</Text>
            <Text className={styles.backText}>{verdict.focus.join('；')}</Text>
            <Text className={styles.backSubtitle}>和解建议</Text>
            <Text className={styles.backText}>{verdict.settlement}</Text>
            <Button className={styles.primaryButtonSmall} hoverClass="none" onClick={() => setFlipped(false)}>
              <View className={styles.buttonInner}>
                <Text className={styles.primaryButtonText}>返回正面</Text>
              </View>
            </Button>
          </View>
        ) : null}
      </View>
    </View>
  );
};

export default IndexPage;
