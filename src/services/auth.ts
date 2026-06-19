import Taro from '@tarojs/taro';
import { authEnabled, authLoginPath, buildApiUrl, businessTokenKey, refreshTokenKey, readStoredBusinessToken } from '@/config/env';

export interface BusinessSession {
  token: string;
  refreshToken?: string;
  userId?: string;
  openId?: string;
  unionId?: string;
  expiresAt?: string;
}

const SESSION_STORAGE_KEY = 'love-court-business-session';
const CLIENT_ID_STORAGE_KEY = 'love-court-client-id';
const CLOUD_OPENID_KEY = 'love-court-cloud-openid';
let bootstrapPromise: Promise<string> | null = null;

function readSession() {
  try {
    return Taro.getStorageSync<BusinessSession>(SESSION_STORAGE_KEY) || null;
  } catch (error) {
    console.error('[Auth] read session failed', error);
    return null;
  }
}

function persistSession(session: BusinessSession) {
  Taro.setStorageSync(SESSION_STORAGE_KEY, session);
  Taro.setStorageSync(businessTokenKey, session.token);
  if (session.refreshToken) {
    Taro.setStorageSync(refreshTokenKey, session.refreshToken);
  }
}

function getOrCreateClientId() {
  try {
    const existing = Taro.getStorageSync<string>(CLIENT_ID_STORAGE_KEY);
    if (existing) {
      return existing;
    }
    const clientId = `client-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
    Taro.setStorageSync(CLIENT_ID_STORAGE_KEY, clientId);
    return clientId;
  } catch (error) {
    console.error('[Auth] client id failed', error);
    return `client-${Date.now().toString(36)}`;
  }
}

async function exchangeWechatCode(code: string) {
  const response = await Taro.request<{ session?: BusinessSession; token?: string; refreshToken?: string; data?: BusinessSession }>({
    url: buildApiUrl(authLoginPath),
    method: 'POST',
    data: { code },
    timeout: 5000,
    header: {
      'Content-Type': 'application/json',
    },
  });

  const payload = (response.data?.session || response.data?.data || (response.data?.token ? (response.data as BusinessSession) : null)) as BusinessSession | undefined;
  if (payload?.token) {
    persistSession(payload);
  }
  return payload;
}

export function getBusinessToken() {
  return readSession()?.token || readStoredBusinessToken();
}

export function getBusinessAuthHeader() {
  const token = getBusinessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getClientIdentityHeader() {
  return { 'X-Love-Court-Client-Id': getOrCreateClientId() };
}

export function clearBusinessSession() {
  Taro.removeStorageSync(SESSION_STORAGE_KEY);
  Taro.removeStorageSync(businessTokenKey);
  Taro.removeStorageSync(refreshTokenKey);
}

async function createBusinessSession() {
  // 使用 Taro.getEnv() 替代 process.env.TARO_ENV，避免 process 未定义问题
  if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP) {
    return getBusinessToken();
  }

  // 1. 云端登录优先（通过云函数获取 openid）
  try {
    const cloudOpenId = await bootstrapCloudSession();
    if (cloudOpenId) {
      return cloudOpenId;
    }
  } catch (error) {
    console.warn('[Auth] cloud session failed, fallback to HTTP', error);
  }

  // 2. 降级到 HTTP 登录（需要自建后端）
  if (!authEnabled) {
    return getBusinessToken();
  }

  const existingToken = getBusinessToken();
  if (existingToken) {
    return existingToken;
  }

  try {
    const loginResult = await Taro.login();
    if (!loginResult.code) {
      return '';
    }

    const session = await exchangeWechatCode(loginResult.code);
    return session?.token || '';
  } catch (error) {
    console.warn('[Auth] bootstrap session failed', error);
    return getBusinessToken();
  }
}

// 云端登录：通过 userLogin 云函数获取 openid
async function bootstrapCloudSession(): Promise<string> {
  if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP) {
    return '';
  }

  // 先检查缓存的 openid
  const cachedOpenId = getCloudOpenId();
  if (cachedOpenId) {
    return cachedOpenId;
  }

  try {
    const { isCloudAvailable, callCloudFunction } = await import('@/services/cloud');
    if (!isCloudAvailable()) {
      return '';
    }

    const result = await callCloudFunction<{ ok: boolean; openid?: string; isNewUser?: boolean }>('userLogin');
    if (result?.ok && result.openid) {
      Taro.setStorageSync(CLOUD_OPENID_KEY, result.openid);
      console.info('[Auth] cloud login success', { isNewUser: result.isNewUser });
      return result.openid;
    }
  } catch (error) {
    console.warn('[Auth] cloud login failed', error);
  }

  return '';
}

// 获取缓存的云端 openid
export function getCloudOpenId(): string {
  try {
    return Taro.getStorageSync<string>(CLOUD_OPENID_KEY) || '';
  } catch {
    return '';
  }
}

export function bootstrapBusinessSession() {
  if (!bootstrapPromise) {
    bootstrapPromise = createBusinessSession().finally(() => {
      bootstrapPromise = null;
    });
  }
  return bootstrapPromise;
}
