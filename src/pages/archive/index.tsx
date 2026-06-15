import React, { useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { courtApi } from '@/services/court';
import type { CourtCase } from '@/types/court';
import { setCurrentCaseId } from '@/utils/court';
import styles from './index.module.scss';

const ArchivePage: React.FC = () => {
  const [cases, setCases] = useState<CourtCase[]>([]);
  const [loading, setLoading] = useState(false);

  useDidShow(() => {
    loadArchive();
  });

  const loadArchive = async () => {
    setLoading(true);
    try {
      const payload = await courtApi.listCases();
      setCases(payload.cases || []);
    } catch (error) {
      console.error('[ArchivePage] loadArchive failed', error);
      Taro.showToast({ title: '案卷读取失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  };

  const openCase = (caseId: string) => {
    setCurrentCaseId(caseId);
    Taro.switchTab({ url: '/pages/index/index' });
  };

  return (
    <View className={styles.container}>
      <View className={styles.header}>
        <Text className={styles.title}>案卷</Text>
        <Text className={styles.desc}>查看已经创建的案件，继续庭审或回看裁决结果。</Text>
        <Button className={styles.refreshButton} loading={loading} onClick={loadArchive}>刷新案卷</Button>
      </View>

      {cases.length ? (
        cases.map((item) => (
          <View key={item.id} className={styles.caseCard} onClick={() => openCase(item.id)}>
            <View className={styles.caseHeader}>
              <Text className={styles.caseNo}>{item.caseNumber}号</Text>
              <Text className={item.verdict ? styles.doneTag : styles.pendingTag}>{item.verdict ? '已宣判' : '庭审中'}</Text>
            </View>
            <Text className={styles.caseTitle}>{item.title || '未命名案件'}</Text>
            <Text className={styles.caseMeta}>原告：{item.plaintiffName || '-'}　被告：{item.defendantName || '-'}</Text>
            <Text className={styles.caseResult}>
              {item.verdict
                ? `责任比例：${item.plaintiffName} ${item.verdict.ratio.plaintiff}% / ${item.defendantName} ${item.verdict.ratio.defendant}%`
                : '双方陈词完成后即可宣判'}
            </Text>
          </View>
        ))
      ) : (
        <View className={styles.emptyCard}>
          <Text className={styles.emptyTitle}>暂无案卷</Text>
          <Text className={styles.emptyText}>回到庭审页创建第一个案件。</Text>
        </View>
      )}
    </View>
  );
};

export default ArchivePage;
