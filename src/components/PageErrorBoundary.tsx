import React from 'react';
import { View, Text } from '@tarojs/components';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * 页面级错误边界
 * 捕获子组件渲染期间的同步错误，避免整个页面白屏
 */
export class PageErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[PageErrorBoundary] caught', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return <>{this.props.fallback}</>;
      return (
        <View style={{ padding: '32px', minHeight: '100vh', background: '#fff5f5' }}>
          <Text style={{ color: '#dc2626', fontSize: '16px', fontWeight: '600' }}>
            页面渲染出错
          </Text>
          <Text style={{ color: '#718096', fontSize: '13px', marginTop: '8px', display: 'block' }}>
            {this.state.error?.message || '未知错误'}
          </Text>
          <Text style={{ color: '#a0aec0', fontSize: '11px', marginTop: '16px', display: 'block' }}>
            请截图此错误并反馈，或尝试刷新页面
          </Text>
        </View>
      );
    }
    return <>{this.props.children}</>;
  }
}

export default PageErrorBoundary;
