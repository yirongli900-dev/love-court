import { useEffect } from 'react';
import { useDidHide, useDidShow } from '@tarojs/taro';
import { bootstrapBusinessSession } from '@/services/auth';
// 全局样式
import './app.scss';

function App(props) {
  useEffect(() => {
    try {
      bootstrapBusinessSession();
    } catch (error) {
      console.error('[App] bootstrapBusinessSession failed', error);
    }
    // 云开发初始化延迟到页面加载后，避免阻塞应用启动
    // 通过动态 import 防止顶层模块加载失败导致整个应用白屏
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
