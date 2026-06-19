# 微信云身份识别与数据隔离部署指南

> 适用范围：云开发用户认证与案件数据隔离方案
> 核心云函数：`caseApi`
> 相关集合：`users`、`cases`

## 1. 架构说明

```
小程序前端
    ↓ wx.cloud.callFunction
caseApi 等业务云函数
    ↓ cloud.getWXContext() 获取 openid（不可伪造）
云数据库 users / cases 集合
    ↓ where({ _openid: openid }) 过滤
仅返回当前用户的数据
```

小程序无需额外调用 `wx.login` 换取业务 Token。每次调用云函数时，微信平台
都会在云端上下文中注入可信 `OPENID`。

**安全保证：**
- openid 由微信平台自动注入，前端无法伪造
- 云函数中显式 `where({_openid})` 过滤（纵深防御）
- 集合设为「仅管理端可读写」，前端无法直接访问数据库

## 2. 创建云数据库集合

### 2.1 创建 users 集合

1. 微信开发者工具 → 云开发控制台 → 数据库
2. 点击「+」新建集合
3. 集合名称：`users`
4. 权限设置：选择「**仅管理端可读写**」

### 2.2 创建 cases 集合

1. 同上步骤
2. 集合名称：`cases`
3. 权限设置：选择「**仅管理端可读写**」

## 3. 部署云函数

### 3.1 部署 userLogin

1. 微信开发者工具左侧文件树
2. 右键 `cloudfunctions/userLogin` → 「上传并部署：云端安装依赖（不上传 node_modules）」
3. 等待部署完成

### 3.2 部署 caseApi

1. 右键 `cloudfunctions/caseApi` → 「上传并部署：云端安装依赖（不上传 node_modules）」
2. 等待部署完成

## 4. 验证部署

### 4.1 验证 userLogin

在云开发控制台 → 云函数 → `userLogin` → 测试：

输入：`{}`

预期返回：
```json
{
  "ok": true,
  "openid": "你的openid",
  "isNewUser": true,
  "user": {
    "openid": "你的openid",
    "nickname": "",
    "createdAt": "2026-06-19T...",
    "lastLoginAt": "2026-06-19T..."
  }
}
```

### 4.2 验证 caseApi - 创建案件

在云函数控制台测试 `caseApi`：

输入：
```json
{
  "action": "create"
}
```

预期返回：
```json
{
  "ok": true,
  "case": {
    "_id": "案件ID",
    "id": "案件ID",
    "_openid": "你的openid",
    "caseNumber": "2026-001",
    "inviteCode": "ABC123",
    "title": "",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### 4.3 验证数据隔离

1. 用户 A 创建案件后
2. 用户 B 调用 `listCases`
3. 用户 B 的列表中**不包含**用户 A 的案件

## 5. 数据库记录结构

### users 集合

```json
{
  "_id": "自动生成",
  "_openid": "用户openid（自动注入）",
  "openid": "用户openid",
  "nickname": "昵称",
  "avatar": "头像URL",
  "createdAt": "2026-06-19T...",
  "lastLoginAt": "2026-06-19T..."
}
```

### cases 集合

```json
{
  "_id": "自动生成",
  "_openid": "创建者openid",
  "caseNumber": "2026-001",
  "inviteCode": "ABC123",
  "title": "案件标题",
  "plaintiffName": "原告",
  "defendantName": "被告",
  "plaintiffStatement": "原告陈词",
  "defendantStatement": "被告陈词",
  "verdict": null,
  "archivedAt": null,
  "deletedAt": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

## 6. 常见错误排查

### 错误：`permission denied` 或 `数据库操作失败`

**原因：** 集合权限未设置为「仅管理端可读写」
**解决：** 云开发控制台 → 数据库 → 集合 → 权限设置 → 改为「仅管理端可读写」

### 错误：`未获取到用户身份`

**原因：** `cloud.getWXContext()` 返回空 openid
**解决：** 确认 `wx.cloud.init({ traceUser: true })` 已执行

### 错误：`案件不存在或无权访问`

**原因：** 跨用户访问或案件已被彻底删除
**解决：** 确认 caseId 属于当前用户（检查 `_openid` 字段）
