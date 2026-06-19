// 用户登录云函数
// 通过 cloud.getWXContext() 获取 openid，自动创建/更新用户记录
// openid 不可伪造，是微信平台注入的权威身份标识
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  // openid 为空说明未登录，拒绝
  if (!openid) {
    return { ok: false, code: 'UNAUTHORIZED', error: '未获取到用户身份' };
  }

  const db = cloud.database();
  const now = new Date().toISOString();

  try {
    // 查询是否已有用户记录
    const { data: existing } = await db.collection('users')
      .where({ openid })
      .limit(1)
      .get();

    if (existing.length > 0) {
      // 已有记录，更新 lastLoginAt
      const user = existing[0];
      await db.collection('users').doc(user._id).update({
        data: { lastLoginAt: now },
      });
      return {
        ok: true,
        openid,
        isNewUser: false,
        user: {
          openid: user.openid,
          nickname: user.nickname || '',
          createdAt: user.createdAt,
          lastLoginAt: now,
        },
      };
    }

    // 首次登录，创建用户记录
    const newUser = {
      openid,
      nickname: '',
      avatar: '',
      createdAt: now,
      lastLoginAt: now,
    };

    const { _id } = await db.collection('users').add({ data: newUser });

    return {
      ok: true,
      openid,
      isNewUser: true,
      user: {
        ...newUser,
        _id,
      },
    };
  } catch (error) {
    console.error('[userLogin] error', error?.message || error);
    return {
      ok: false,
      code: 'DB_ERROR',
      error: '用户记录操作失败',
    };
  }
};
