import { useEffect } from 'react';
import { useDidHide, useDidShow } from '@tarojs/taro';
// 全局样式
import './app.scss';

function App(props) {
  useEffect(() => {
    // 云函数通过微信上下文识别用户，应用启动时只需初始化云开发。
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
