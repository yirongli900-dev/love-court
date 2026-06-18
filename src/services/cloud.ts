declare const wx: any;

/**
 * 微信云开发抽象层
 *
 * 封装 wx.cloud.callFunction，提供：
 * - isCloudAvailable()：检查云开发是否可用
 * - callCloudFunction<T>(name, data?)：调用云函数
 * - initCloudDevelopment()：初始化云开发环境
 * - pingHealthCheck()：连通性验证工具
 */

// 自定义错误：云开发不可用
export class CloudDevelopmentNotAvailableError extends Error {
  constructor(message = '云开发未启用或当前环境不支持') {
    super(message);
    this.name = 'CloudDevelopmentNotAvailableError';
  }
}

/**
 * 检查云开发是否可用
 * 条件：当前为微信小程序环境 + 云开发已启用 + wx.cloud 全局对象存在
 */
export function isCloudAvailable(): boolean {
  try {
    if (typeof process === 'undefined' || process.env.TARO_ENV !== 'weapp') {
      return false;
    }
    // 动态读取 cloudEnabled，避免循环依赖
    const { cloudEnabled } = require('@/config/env');
    if (!cloudEnabled) return false;
    // 检查 wx.cloud 全局对象
    if (typeof wx === 'undefined' || !wx.cloud) {
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[Cloud] isCloudAvailable check failed', error);
    return false;
  }
}

/**
 * 初始化云开发环境
 * 在小程序入口调用，失败不抛错只输出日志
 */
export function initCloudDevelopment(): void {
  if (typeof process === 'undefined' || process.env.TARO_ENV !== 'weapp') {
    console.info('[Cloud] skip init: not in weapp env');
    return;
  }
  try {
    const { cloudEnabled, cloudEnvId } = require('@/config/env');
    if (!cloudEnabled) {
      console.info('[Cloud] skip init: cloud disabled');
      return;
    }
    if (typeof wx === 'undefined' || !wx.cloud) {
      console.warn('[Cloud] skip init: wx.cloud not available');
      return;
    }
    wx.cloud.init({
      env: cloudEnvId,
      traceUser: true,
    });
    console.info('[Cloud] init success', { env: cloudEnvId });
  } catch (error) {
    console.error('[Cloud] init failed', error);
  }
}

/**
 * 调用云函数
 * @param name 云函数名
 * @param data 传入云函数的事件参数
 * @returns 云函数 result 字段内容
 * @throws CloudDevelopmentNotAvailableError 当云开发不可用时
 */
export async function callCloudFunction<T = unknown>(name: string, data?: Record<string, unknown>): Promise<T> {
  if (!isCloudAvailable()) {
    throw new CloudDevelopmentNotAvailableError();
  }
  try {
    const response = await wx.cloud.callFunction({
      name,
      data,
    });
    console.info('[Cloud] callFunction success', { name });
    return response.result as T;
  } catch (error) {
    console.error('[Cloud] callFunction failed', { name, error });
    throw error;
  }
}

/**
 * 健康检查：调用 healthCheck 云函数验证连通性
 * @returns true 表示连通正常
 */
export async function pingHealthCheck(): Promise<boolean> {
  try {
    const result = await callCloudFunction<{ ok: boolean; env: string; openid: string }>('healthCheck');
    return Boolean(result?.ok && result?.openid);
  } catch (error) {
    console.warn('[Cloud] pingHealthCheck failed', error);
    return false;
  }
}
