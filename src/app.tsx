import { useEffect } from 'react';
import { useDidHide, useDidShow } from '@tarojs/taro';
import { bootstrapBusinessSession } from '@/services/auth';
import { initCloudDevelopment } from '@/services/cloud';
// 全局样式
import './app.scss';

function App(props) {
  useEffect(() => {
    bootstrapBusinessSession();
    // 初始化微信云开发（与业务鉴权并列，互不依赖、互不阻塞）
    initCloudDevelopment();
  }, []);

  // 对应 onShow
  useDidShow(() => {});

  // 对应 onHide
  useDidHide(() => {});

  return props.children;
}

export default App;
