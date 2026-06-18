import { useDidHide, useDidShow } from '@tarojs/taro';
// 全局样式
import './app.scss';

function App(props) {
  // 对应 onShow
  useDidShow(() => {});

  // 对应 onHide
  useDidHide(() => {});

  return props.children;
}

export default App;
