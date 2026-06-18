# 微信云开发配置指南

> 适用范围：feature/wechat-cloud-adaptation 分支

## 1. 开通微信云开发

### 前置条件
- 已注册微信小程序账号（个人/企业主体均可）
- 已获取小程序 AppID
- 已安装微信开发者工具

### 开通步骤
1. 打开微信开发者工具，导入项目（dist 目录）
2. 点击工具栏「云开发」按钮
3. 弹出开通引导，点击「开通」
4. 创建云开发环境（输入名称，选择免费基础版）
5. 等待创建完成（约 1-3 分钟）

## 2. 获取环境 ID

云开发环境创建完成后：
1. 进入云开发控制台
2. 顶部右上角显示当前环境名称
3. 点击「设置」→「环境设置」可查看环境 ID（形如 `cloud1-xxxxxxx`）
4. 本项目预设环境 ID：`cloud1-d7g0sqy2891bd103a`，如不同请替换 `.env.development` 和 `.env.production` 中的 `TARO_APP_CLOUD_ENV`

## 3. 部署 healthCheck 云函数

### 部署步骤
1. 在微信开发者工具左侧文件树中找到 `cloudfunctions/healthCheck` 目录
2. 右键点击 `healthCheck` 目录
3. 选择「上传并部署：云端安装依赖（不上传 node_modules）」
4. 等待上传完成（首次约 30 秒，云端会自动安装 wx-server-sdk）

### 验证部署
1. 打开云开发控制台 → 「云函数」
2. 在列表中看到 `healthCheck`
3. 点击「测试」按钮
4. 输入空 JSON `{}`，点击运行
5. 返回结果应包含：
   ```json
   {
     "ok": true,
     "env": "cloud1-d7g0sqy2891bd103a",
     "openid": "your_openid",
     "timestamp": 1700000000000
   }
   ```

## 4. 启用云开发

### 开发环境
- 修改 `.env.development`：
  ```
  TARO_APP_CLOUD_ENABLED=true
  ```
- 重新构建：`npm run dev:weapp`
- 在小程序首页点击「测试云连接」按钮验证

### 生产环境
- 修改 `.env.production`：
  ```
  TARO_APP_CLOUD_ENABLED=true
  ```
- 上传正式版本

## 5. 连通性验证

### 通过小程序界面
- 启动小程序
- 在首页（开发模式）会出现「测试云连接」按钮
- 点击按钮：
  - 成功：toast 显示「云连接正常」
  - 失败：toast 显示具体错误

### 通过控制台
- 在小程序任意页面打开调试器 Console
- 输入：
  ```javascript
   wx.cloud.callFunction({ name: 'healthCheck' }).then(console.log)
   ```

## 6. 常见错误排查

### 错误 1：`env function not found`
- **原因**：云函数未部署或部署失败
- **解决**：重新右键 `cloudfunctions/healthCheck` 上传并部署

### 错误 2：`cloud init error`
- **原因**：环境 ID 不正确
- **解决**：检查 `.env.*` 中的 `TARO_APP_CLOUD_ENV` 是否与云开发控制台显示的环境 ID 一致

### 错误 3：`permission denied`
- **原因**：当前用户未加入云开发环境的成员列表
- **解决**：云开发控制台 → 「成员管理」→ 添加开发者

### 错误 4：调用返回 `undefined`
- **原因**：`wx.cloud.init` 未调用或失败
- **解决**：确认 `.env.*` 中 `TARO_APP_CLOUD_ENABLED=true`，重启小程序

## 7. 关闭云开发（回退到本地兜底）

如需临时禁用云开发，保持现有 HTTP 后端 + 本地兜底链路：
- 修改 `.env.development`：
  ```
  TARO_APP_CLOUD_ENABLED=false
  ```
- 重新构建并部署

应用会自动回退到原有 `Taro.request` + 本地存储链路，所有功能保持可用。
