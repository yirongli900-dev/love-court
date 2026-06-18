// 健康检查云函数：返回云环境信息与调用者 openid
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  return {
    ok: true,
    env: wxContext.ENV,
    openid: wxContext.OPENID,
    unionid: wxContext.UNIONID,
    appid: wxContext.APPID,
    timestamp: Date.now(),
    receivedEvent: event,
  };
};
