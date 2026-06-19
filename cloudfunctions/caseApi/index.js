// 案件 CRUD 云函数
// 情侣法庭：案件在两人之间共享
// - 创建者（原告）通过 _openid 归属
// - 被邀请者（被告）通过 inviteCode 加入 participants 数组
// - 读取和更新：创建者 + participants 均可
// - 删除/归档：仅创建者
// - 列表查询：返回用户创建或参与的所有案件
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// 获取调用者 openid
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

// 验证用户是否有权访问案件（创建者或参与者）
function hasCaseAccess(caseData, openid) {
  if (!caseData) return false;
  if (caseData._openid === openid) return true;
  if (Array.isArray(caseData.participants) && caseData.participants.includes(openid)) return true;
  return false;
}

exports.main = async (event, context) => {
  const openid = getOpenId();

  if (!openid) {
    console.error('[caseApi] UNAUTHORIZED: no openid');
    return { ok: false, code: 'UNAUTHORIZED', error: '未获取到用户身份' };
  }

  const { action } = event;
  console.info('[caseApi] action', { action, openid: openid.slice(0, 8) + '...' });

  try {
    switch (action) {
      case 'create':
        return await handleCreate(openid, event);
      case 'get':
        return await handleGet(openid, event);
      case 'join':
        return await handleJoin(openid, event);
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
    console.error('[caseApi] error', { action, openid: openid.slice(0, 8) + '...', error: error?.message || error });
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
    _openid: openid,
    participants: [openid],  // 参与者列表，创建者自动加入
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
  console.info('[caseApi] create success', { _id, openid: openid.slice(0, 8) + '...' });

  return {
    ok: true,
    case: { ...newCase, id: _id, _id },
  };
}

// 查询单个案件（仅创建者或参与者可读取）
async function handleGet(openid, event) {
  const { caseId } = event;
  if (!caseId) {
    return { ok: false, error: '缺少 caseId' };
  }

  // 按 _id 查询（不按 _openid 过滤，因为案件在两人间共享）
  const { data } = await db.collection('cases')
    .where({ _id: caseId, deletedAt: null })
    .limit(1)
    .get();

  if (data.length === 0) {
    return { ok: false, error: '案件不存在或已被删除' };
  }

  const caseData = data[0];

  // 权限校验：只有创建者或参与者才能读取
  if (!hasCaseAccess(caseData, openid)) {
    console.warn('[caseApi] get DENIED', {
      caseId,
      openid: openid.slice(0, 8) + '...',
      caseOwner: caseData._openid?.slice(0, 8) + '...',
    });
    return { ok: false, error: '无权访问该案件' };
  }

  console.info('[caseApi] get success', {
    caseId,
    openid: openid.slice(0, 8) + '...',
    participants: caseData.participants?.length || 0,
  });

  return { ok: true, case: { ...caseData, id: caseData._id } };
}

// 加入案件（通过邀请码）
async function handleJoin(openid, event) {
  const { caseId, inviteCode } = event;
  if (!caseId) {
    return { ok: false, error: '缺少 caseId' };
  }

  const { data } = await db.collection('cases')
    .where({ _id: caseId, deletedAt: null })
    .limit(1)
    .get();

  if (data.length === 0) {
    return { ok: false, error: '案件不存在或已被删除' };
  }

  const caseData = data[0];

  // 如果已经是参与者，直接返回
  if (hasCaseAccess(caseData, openid)) {
    console.info('[caseApi] join already participant', {
      caseId,
      openid: openid.slice(0, 8) + '...',
    });
    return { ok: true, case: { ...caseData, id: caseData._id } };
  }

  // 校验邀请码
  if (caseData.inviteCode && inviteCode !== caseData.inviteCode) {
    console.warn('[caseApi] join inviteCode mismatch', {
      caseId,
      openid: openid.slice(0, 8) + '...',
    });
    return { ok: false, error: '邀请码不正确' };
  }

  // 将加入者添加到参与者列表
  const participants = Array.isArray(caseData.participants) ? [...caseData.participants] : [caseData._openid];
  participants.push(openid);

  await db.collection('cases').doc(caseId).update({
    data: { participants },
  });

  console.info('[caseApi] join success', {
    caseId,
    openid: openid.slice(0, 8) + '...',
    participantsCount: participants.length,
  });

  return { ok: true, case: { ...caseData, participants, id: caseData._id } };
}

// 查询案件列表（用户创建的 + 用户参与的案件）
async function handleList(openid, event) {
  const page = Number(event.page) || 1;
  const pageSize = Number(event.pageSize) || 10;
  const skip = (page - 1) * pageSize;

  // 查询条件：创建者 OR 参与者（使用 participants 数组包含当前用户）
  const query = db.collection('cases')
    .where(_.or([
      { _openid: openid, deletedAt: null },
      { participants: _.elemMatch(_.eq(openid)), deletedAt: null },
    ]))
    .orderBy('updatedAt', 'desc');

  const { total } = await query.count();
  const { data } = await query.skip(skip).limit(pageSize).get();

  console.info('[caseApi] list', {
    openid: openid.slice(0, 8) + '...',
    total,
    page,
    pageSize,
  });

  return {
    ok: true,
    cases: data.map(item => ({ ...item, id: item._id })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// 更新案件（仅创建者或参与者可更新，且只能更新自己角色的字段）
async function handleUpdate(openid, event) {
  const { caseId, patch } = event;
  if (!caseId) {
    return { ok: false, error: '缺少 caseId' };
  }

  // 先获取案件，校验权限
  const { data } = await db.collection('cases')
    .where({ _id: caseId, deletedAt: null })
    .limit(1)
    .get();

  if (data.length === 0) {
    return { ok: false, error: '案件不存在' };
  }

  const caseData = data[0];

  // 权限校验：只有创建者或参与者才能更新
  if (!hasCaseAccess(caseData, openid)) {
    console.warn('[caseApi] update DENIED', {
      caseId,
      openid: openid.slice(0, 8) + '...',
      caseOwner: caseData._openid?.slice(0, 8) + '...',
    });
    return { ok: false, error: '无权操作该案件' };
  }

  // 按角色过滤可更新字段
  const role = patch?.role;
  const allowedFields = role === 'defendant'
    ? ['defendantStatement', 'defendantAnswer']
    : ['title', 'plaintiffName', 'defendantName', 'plaintiffStatement', 'plaintiffAnswer'];

  const filteredPatch = {};
  for (const key of allowedFields) {
    if (patch[key] !== undefined) {
      filteredPatch[key] = patch[key];
    }
  }

  const now = new Date().toISOString();
  const updateData = { ...filteredPatch, updatedAt: now };

  await db.collection('cases').doc(caseId).update({ data: updateData });

  const { data: updated } = await db.collection('cases').doc(caseId).get();

  console.info('[caseApi] update success', {
    caseId,
    openid: openid.slice(0, 8) + '...',
    role,
    updatedFields: Object.keys(filteredPatch),
  });

  return { ok: true, case: { ...updated, id: updated._id } };
}

// 软删除 / 归档（仅创建者）
async function handleSoftDelete(openid, event, type) {
  const { caseId } = event;
  if (!caseId) {
    return { ok: false, error: '缺少 caseId' };
  }

  // 仅创建者可删除/归档
  const { data } = await db.collection('cases')
    .where({ _id: caseId, _openid: openid })
    .limit(1)
    .get();

  if (data.length === 0) {
    return { ok: false, error: '无权操作：仅创建者可删除/归档' };
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

// 恢复案件（仅创建者）
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
    return { ok: false, error: '无权操作' };
  }

  const now = new Date().toISOString();
  await db.collection('cases').doc(caseId).update({
    data: { archivedAt: null, deletedAt: null, updatedAt: now },
  });

  const { data: updated } = await db.collection('cases').doc(caseId).get();
  return { ok: true, case: { ...updated, id: updated._id } };
}

// 彻底删除（仅创建者）
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
    return { ok: false, error: '无权操作' };
  }

  await db.collection('cases').doc(caseId).remove();
  console.info('[caseApi] purge success', {
    caseId,
    openid: openid.slice(0, 8) + '...',
  });
  return { ok: true };
}
