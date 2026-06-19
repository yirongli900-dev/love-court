// 案件 CRUD 云函数
// 情侣法庭：案件在两人之间共享
// - 创建者（原告）通过 _openid 归属
// - 被邀请者（被告）通过 inviteCode 加入
// - 读取和更新：创建者 + 被邀请者均可
// - 删除/归档：仅创建者
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
    console.error('[caseApi] error', { action, error: error?.message || error });
    return { ok: false, error: error?.message || '操作失败' };
  }
};

// 创建案件
async function handleCreate(openid, event) {
  const now = new Date().toISOString();

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

  return {
    ok: true,
    case: { ...newCase, id: _id, _id },
  };
}

// 查询单个案件（创建者 + 参与者均可读取）
async function handleGet(openid, event) {
  const { caseId } = event;
  if (!caseId) {
    return { ok: false, error: '缺少 caseId' };
  }

  // 只按 _id 查询，不再过滤 _openid（情侣法庭案件在两人间共享）
  const { data } = await db.collection('cases')
    .where({ _id: caseId, deletedAt: null })
    .limit(1)
    .get();

  if (data.length === 0) {
    return { ok: false, error: '案件不存在或已被删除' };
  }

  return { ok: true, case: { ...data[0], id: data[0]._id } };
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

  // 校验邀请码（如果案件有邀请码且调用者不是创建者）
  if (caseData._openid !== openid && caseData.inviteCode) {
    if (inviteCode !== caseData.inviteCode) {
      return { ok: false, error: '邀请码不正确' };
    }
  }

  // 将加入者添加到参与者列表（如果尚未存在）
  if (!caseData.participants) {
    caseData.participants = [caseData._openid];
  }
  if (!caseData.participants.includes(openid)) {
    caseData.participants.push(openid);
    await db.collection('cases').doc(caseId).update({
      data: { participants: caseData.participants },
    });
  }

  return { ok: true, case: { ...caseData, id: caseData._id } };
}

// 查询案件列表（仅创建者的案件）
async function handleList(openid, event) {
  const page = Number(event.page) || 1;
  const pageSize = Number(event.pageSize) || 10;
  const skip = (page - 1) * pageSize;

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

// 更新案件（创建者 + 参与者均可更新各自的陈词）
async function handleUpdate(openid, event) {
  const { caseId, patch } = event;
  if (!caseId) {
    return { ok: false, error: '缺少 caseId' };
  }

  // 按 _id 查询（参与者也能更新）
  const { data } = await db.collection('cases')
    .where({ _id: caseId, deletedAt: null })
    .limit(1)
    .get();

  if (data.length === 0) {
    return { ok: false, error: '案件不存在' };
  }

  const now = new Date().toISOString();
  const updateData = { ...patch, updatedAt: now };
  delete updateData._id;
  delete updateData._openid;

  await db.collection('cases').doc(caseId).update({ data: updateData });

  const { data: updated } = await db.collection('cases').doc(caseId).get();
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
  return { ok: true };
}
