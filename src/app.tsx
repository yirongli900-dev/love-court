import { useEffect, useState } from 'react';
import { useDidHide, useDidShow } from '@tarojs/taro';
import { bootstrapBusinessSession } from '@/services/auth';
// 全局样式
import './app.scss';

function App(props) {
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // 等待登录会话初始化完成，再渲染子页面
    // 避免页面在未登录时提前请求接口触发 401
    bootstrapBusinessSession().finally(() => setSessionReady(true));

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

  if (!sessionReady) return null;

  return props.children;
}

export default App;
