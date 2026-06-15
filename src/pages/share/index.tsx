import React, { useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro';
import { courtApi } from '@/services/court';
import type { CourtCase } from '@/types/court';
import { getCurrentCaseId, getProviderLabel } from '@/utils/court';
import styles from './index.module.scss';

const SharePage: React.FC = () => {
  const [caseData, setCaseData] = useState<CourtCase | null>(null);
  const [loading, setLoading] = useState(false);

  useDidShow(() => {
    loadCurrentCase();
  });

  useShareAppMessage(() => ({
    title: `裁决书：${caseData?.title || '情侣法庭'}`,
    path: `/pages/index/index?case=${caseData?.id || ''}&role=defendant`,
  }));

  const loadCurrentCase = async () => {
    const caseId = getCurrentCaseId();
    if (!caseId) return;
    setLoading(true);
    try {
      const payload = await courtApi.getCase(caseId);
      setCaseData(payload.case);
    } catch (error) {
      console.error('[SharePage] loadCurrentCase failed', error);
      Taro.showToast({ title: '裁决读取失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  const copyVerdict = async () => {
    if (!caseData?.verdict) {
      Taro.showToast({ title: '请先生成裁决', icon: 'none' });
      return;
    }
    const verdict = caseData.verdict;
    const content = [
      '爱情法庭裁决书',
      `${caseData.caseNumber}号案件`,
      `案由：${caseData.title}`,
      `责任比例：${caseData.plaintiffName} ${verdict.ratio.plaintiff}% / ${caseData.defendantName} ${verdict.ratio.defendant}%`,
      `判决结果：${verdict.penalty}`,
      getProviderLabel(verdict.provider, verdict.model),
    ].join('\n');
    await Taro.setClipboardData({ data: content });
  };

  const verdict = caseData?.verdict;

  return (
    <View className={styles.container}>
      <View className={styles.header}>
        <Text className={styles.title}>分享裁决</Text>
        <Text className={styles.desc}>复制裁决文字或使用微信右上角转发给对方。</Text>
        <Button className={styles.refreshButton} hoverClass="none" loading={loading} onClick={loadCurrentCase}>
          <View className={styles.buttonInner}>
            <Text className={styles.refreshButtonText}>刷新裁决</Text>
          </View>
        </Button>
      </View>

      {caseData && verdict ? (
        <View className={styles.posterCard}>
          <Text className={styles.brand}>Love Court</Text>
          <Text className={styles.caseNo}>{caseData.caseNumber}号案件</Text>
          <Text className={styles.caseTitle}>{caseData.title}</Text>
          <View className={styles.ratioBox}>
            <Text className={styles.ratio}>{caseData.plaintiffName} {verdict.ratio.plaintiff}%</Text>
            <Text className={styles.vs}>VS</Text>
            <Text className={styles.ratio}>{caseData.defendantName} {verdict.ratio.defendant}%</Text>
          </View>
          <Text className={styles.reason}>{verdict.reason}</Text>
          <Text className={styles.penalty}>{verdict.penalty}</Text>
          <Text className={styles.provider}>{getProviderLabel(verdict.provider, verdict.model)}</Text>
          <Button className={styles.primaryButton} hoverClass="none" onClick={copyVerdict}>
            <View className={styles.buttonInner}>
              <Text className={styles.primaryButtonText}>复制裁决文字</Text>
            </View>
          </Button>
          <Button className={styles.secondaryButton} hoverClass="none" openType="share">
            <View className={styles.buttonInner}>
              <Text className={styles.secondaryButtonText}>转发给对方</Text>
            </View>
          </Button>
        </View>
      ) : (
        <View className={styles.emptyCard}>
          <Text className={styles.emptyTitle}>暂无可分享裁决</Text>
          <Text className={styles.emptyText}>回到庭审页完成双方陈词并生成裁决。</Text>
        </View>
      )}
    </View>
  );
};

export default SharePage;
