import Taro from '@tarojs/taro';

// ====================================================================
// 环境变量说明
// ====================================================================
// 所有 process.env.TARO_APP_* 在编译时由 config/index.ts 的 defineConstants
// 通过 webpack DefinePlugin 静态替换为字面量字符串。
//
// 关键规则：
// 1. 必须直接引用 process.env.SPECIFIC_KEY，不能用 process.env[key] 动态访问
// 2. 不要用 typeof process !== 'undefined' 守卫——在 miniapp 运行时 process
//    不存在，会导致短路返回默认值，跳过 DefinePlugin 已替换的字面量
// 3. DefinePlugin 替换后，process.env.TARO_APP_CLOUD_ENABLED 变成 "true" 字面量
// ====================================================================

const DEFAULT_DEV_API_BASE = 'http://127.0.0.1:3000';
const DEFAULT_PROD_API_BASE = 'https://api.love-court.example.com';

export type AppRuntimeEnv = 'development' | 'production';

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, '');
}

// 运行环境：编译时由 defineConstants 注入 TARO_APP_ENV 和 NODE_ENV
// DefinePlugin 替换后此处为字面量比较，无运行时 process 访问
const _envFlag = process.env.TARO_APP_ENV;
const _nodeEnv = process.env.NODE_ENV;

export const runtimeEnv: AppRuntimeEnv =
  _envFlag === 'production' || _nodeEnv === 'production' ? 'production' : 'development';

export const isDevelopmentEnv = runtimeEnv === 'development';
export const isProductionEnv = runtimeEnv === 'production';

// API 基础地址（DefinePlugin 替换 process.env.TARO_APP_API_BASE 为字面量）
export const apiBaseUrl = normalizeBaseUrl(
  process.env.TARO_APP_API_BASE || (isProductionEnv ? DEFAULT_PROD_API_BASE : DEFAULT_DEV_API_BASE),
);

// 登录开关
export const authEnabled = process.env.TARO_APP_LOGIN_ENABLED !== 'false';
export const authLoginPath = process.env.TARO_APP_AUTH_LOGIN_PATH || '/api/auth/wechat/login';
export const businessTokenKey = process.env.TARO_APP_TOKEN_KEY || 'love-court-business-token';
export const refreshTokenKey = process.env.TARO_APP_REFRESH_TOKEN_KEY || 'love-court-refresh-token';

// 云开发配置
export const cloudEnvId = process.env.TARO_APP_CLOUD_ENV || 'cloud1-d7g0sqy2891bd103a';
export const cloudEnabled = process.env.TARO_APP_CLOUD_ENABLED !== 'false';

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${apiBaseUrl}${normalizedPath}`;
}

export function readStoredBusinessToken() {
  try {
    return Taro.getStorageSync<string>(businessTokenKey) || '';
  } catch (error) {
    console.error('[Env] read token failed', error);
    return '';
  }
}
