import { useEffect } from 'react';
import { useDidHide, useDidShow } from '@tarojs/taro';
import { bootstrapBusinessSession } from '@/services/auth';
// 全局样式
import './app.scss';

function App(props) {
  useEffect(() => {
    // 1. 后台初始化业务会话（不阻塞渲染）
    bootstrapBusinessSession().catch((error) => {
      console.warn('[App] bootstrapBusinessSession failed', error);
    });

    // 2. 云开发初始化（动态 import 隔离，失败不影响应用启动）
    import('@/services/cloud')
      .then(({ initCloudDevelopment }) => {
        try {
          initCloudDevelopment();
        } catch (error) {
          console.error('[App] initCloudDevelopment failed', error);
        }
      })
      .catch((error) => {
        console.warn('[App] cloud module load failed', error);
      });
  }, []);

  // 对应 onShow
  useDidShow(() => {});

  // 对应 onHide
  useDidHide(() => {});

  return props.children;
}

export default App;
