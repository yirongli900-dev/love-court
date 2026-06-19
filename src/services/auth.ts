import Taro from '@tarojs/taro';

const CLIENT_ID_STORAGE_KEY = 'love-court-client-id';

function getOrCreateClientId() {
  try {
    const existing = Taro.getStorageSync<string>(CLIENT_ID_STORAGE_KEY);
    if (existing) return existing;

    const clientId = `client-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
    Taro.setStorageSync(CLIENT_ID_STORAGE_KEY, clientId);
    return clientId;
  } catch (error) {
    console.error('[Auth] client id failed', error);
    return `client-${Date.now().toString(36)}`;
  }
}

// HTTP fallback only. Cloud functions identify users through getWXContext().OPENID.
export function getClientIdentityHeader() {
  return { 'X-Love-Court-Client-Id': getOrCreateClientId() };
}
