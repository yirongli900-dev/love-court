// 案件 CRUD 云函数
// 统一入口，通过 openid 实现数据隔离
// 所有操作通过 cloud.getWXContext() 获取 openid，用 where({ _openid }) 过滤
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// 获取调用者 openid（权威身份，不可伪造）
function getOpenId() {
  const wxContext = cloud.getWXContext();
  return wxContext.OPENID;
}

// 生成案件编号
function generateCaseNumber(existingCount) {
  const year = new Date().getFullYear();
  return `${year}-${String(existingCount + 1).padStart(3, '0')}`;
}

// 生成邀请码
function generateInviteCode() {
  return Math.random().toString(16).slice(2, 8).toUpperCase();
}

exports.main = async (event, context) => {
  const openid = getOpenId();

  if (!openid) {
    return { ok: false, code: 'UNAUTHORIZED', error: '未获取到用户身份' };
  }

  const { action } = event;

  try {
    switch (action) {
      case 'create':
        return await handleCreate(openid, event);
      case 'get':
        return await handleGet(openid, event);
      case 'list':
        return await handleList(openid, event);
      case 'update':
        return await handleUpdate(openid, event);
      case 'delete':
        return await handleSoftDelete(openid, event, 'delete');
      case 'archive':
        return await handleSoftDelete(openid, event, 'archive');
      case 'restore':
        return await handleRestore(openid, event);
      case 'purge':
        return await handlePurge(openid, event);
      default:
        return { ok: false, error: `未知 action: ${action}` };
    }
  } catch (error) {
    console.error('[caseApi] error', { action, error: error?.message || error });
    return { ok: false, error: error?.message || '操作失败' };
  }
};

// 创建案件
async function handleCreate(openid, event) {
  const now = new Date().toISOString();

  // 统计当前用户已有案件数（用于案件编号）
  const { total } = await db.collection('cases')
    .where({ _openid: openid })
    .count();

  const newCase = {
    _openid: openid,  // 显式写入，确保归属
    caseNumber: generateCaseNumber(total),
    inviteCode: generateInviteCode(),
    title: '',
    plaintiffName: '',
    defendantName: '',
    plaintiffStatement: '',
    defendantStatement: '',
    plaintiffAnswer: '',
    defendantAnswer: '',
    question: '',
    verdict: null,
    archivedAt: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const { _id } = await db.collection('cases').add({ data: newCase });

  return {
    ok: true,
    case: { ...newCase, id: _id, _id },
  };
}

// 查询单个案件（带权限校验）
async function handleGet(openid, event) {
  const { caseId } = event;
  if (!caseId) {
    return { ok: false, error: '缺少 caseId' };
  }

  // where 同时过滤 _id 和 _openid，确保只能查到自己的案件
  const { data } = await db.collection('cases')
    .where({ _id: caseId, _openid: openid })
    .limit(1)
    .get();

  if (data.length === 0) {
    return { ok: false, error: '案件不存在或无权访问' };
  }

  return { ok: true, case: { ...data[0], id: data[0]._id } };
}

// 查询案件列表（分页）
async function handleList(openid, event) {
  const page = Number(event.page) || 1;
  const pageSize = Number(event.pageSize) || 10;
  const skip = (page - 1) * pageSize;

  // 查询当前用户的案件（排除已删除）
  const query = db.collection('cases')
    .where({ _openid: openid, deletedAt: null })
    .orderBy('updatedAt', 'desc');

  const { total } = await query.count();
  const { data } = await query.skip(skip).limit(pageSize).get();

  return {
    ok: true,
    cases: data.map(item => ({ ...item, id: item._id })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// 更新案件
async function handleUpdate(openid, event) {
  const { caseId, patch } = event;
  if (!caseId) {
    return { ok: false, error: '缺少 caseId' };
  }

  // 先校验权限
  const { data } = await db.collection('cases')
    .where({ _id: caseId, _openid: openid })
    .limit(1)
    .get();

  if (data.length === 0) {
    return { ok: false, error: '案件不存在或无权访问' };
  }

  const now = new Date().toISOString();
  const updateData = { ...patch, updatedAt: now };
  delete updateData._id;
  delete updateData._openid;

  await db.collection('cases').doc(caseId).update({ data: updateData });

  // 返回更新后的案件
  const { data: updated } = await db.collection('cases').doc(caseId).get();
  return { ok: true, case: { ...updated, id: updated._id } };
}

// 软删除 / 归档
async function handleSoftDelete(openid, event, type) {
  const { caseId } = event;
  if (!caseId) {
    return { ok: false, error: '缺少 caseId' };
  }

  const { data } = await db.collection('cases')
    .where({ _id: caseId, _openid: openid })
    .limit(1)
    .get();

  if (data.length === 0) {
    return { ok: false, error: '案件不存在或无权访问' };
  }

  const now = new Date().toISOString();
  const updateData = { updatedAt: now };
  if (type === 'delete') {
    updateData.deletedAt = now;
  } else if (type === 'archive') {
    updateData.archivedAt = now;
  }

  await db.collection('cases').doc(caseId).update({ data: updateData });

  const { data: updated } = await db.collection('cases').doc(caseId).get();
  return { ok: true, case: { ...updated, id: updated._id } };
}

// 恢复案件
async function handleRestore(openid, event) {
  const { caseId } = event;
  if (!caseId) {
    return { ok: false, error: '缺少 caseId' };
  }

  const { data } = await db.collection('cases')
    .where({ _id: caseId, _openid: openid })
    .limit(1)
    .get();

  if (data.length === 0) {
    return { ok: false, error: '案件不存在或无权访问' };
  }

  const now = new Date().toISOString();
  await db.collection('cases').doc(caseId).update({
    data: { archivedAt: null, deletedAt: null, updatedAt: now },
  });

  const { data: updated } = await db.collection('cases').doc(caseId).get();
  return { ok: true, case: { ...updated, id: updated._id } };
}

// 彻底删除
async function handlePurge(openid, event) {
  const { caseId } = event;
  if (!caseId) {
    return { ok: false, error: '缺少 caseId' };
  }

  const { data } = await db.collection('cases')
    .where({ _id: caseId, _openid: openid })
    .limit(1)
    .get();

  if (data.length === 0) {
    return { ok: false, error: '案件不存在或无权访问' };
  }

  await db.collection('cases').doc(caseId).remove();
  return { ok: true };
}
