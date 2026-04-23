const ApprovalRequest = require('../models/ApprovalRequest');
const {
  createProductFromPayload,
  createPurchaseFromPayload,
  createSaleFromPayload,
  createTransferFromPayload,
  createStockInFromPayload,
  createStockOutFromPayload,
} = require('../services/approvalExecutionService');

const executeApprovalRequest = async (request) => {
  if (request.actionType === 'create_product') {
    const product = await createProductFromPayload(request.payload, request.requestedBy);
    return { entityType: 'Product', entityId: product?._id };
  }

  if (request.actionType === 'create_purchase') {
    const purchase = await createPurchaseFromPayload(request.payload, request.requestedBy);
    return { entityType: 'Purchase', entityId: purchase?._id };
  }

  if (request.actionType === 'create_sale') {
    const sale = await createSaleFromPayload(request.payload, request.requestedBy);
    return { entityType: 'Sale', entityId: sale?._id };
  }

  if (request.actionType === 'create_transfer') {
    const transfer = await createTransferFromPayload(request.payload, request.requestedBy);
    return { entityType: 'Transfer', entityId: transfer?._id };
  }

  if (request.actionType === 'create_stock_in') {
    const inventory = await createStockInFromPayload(request.payload, request.requestedBy);
    return { entityType: 'Inventory', entityId: inventory?._id };
  }

  if (request.actionType === 'create_stock_out') {
    const inventory = await createStockOutFromPayload(request.payload, request.requestedBy);
    return { entityType: 'Inventory', entityId: inventory?._id };
  }

  throw new Error('Unsupported request action type');
};

exports.getApprovalRequests = async (req, res) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const [requests, total] = await Promise.all([
      ApprovalRequest.find(query)
        .populate('requestedBy', 'firstName lastName email')
        .populate('reviewedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      ApprovalRequest.countDocuments(query),
    ]);

    res.json({ data: requests, total, page: pageNum, limit: limitNum });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { note = '' } = req.body || {};

    const request = await ApprovalRequest.findById(id);
    if (!request) return res.status(404).json({ error: 'Approval request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending requests can be approved' });
    }

    const execution = await executeApprovalRequest(request);

    request.status = 'approved';
    request.reviewedBy = req.user?._id;
    request.reviewedAt = new Date();
    request.reviewNote = note;
    request.executedEntityType = execution.entityType;
    request.executedEntityId = execution.entityId;

    await request.save();

    const updated = await ApprovalRequest.findById(id)
      .populate('requestedBy', 'firstName lastName email')
      .populate('reviewedBy', 'firstName lastName email');

    res.json({ message: 'Request approved and executed', data: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { note = '' } = req.body || {};

    const request = await ApprovalRequest.findById(id);
    if (!request) return res.status(404).json({ error: 'Approval request not found' });
    if (request.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending requests can be rejected' });
    }

    request.status = 'rejected';
    request.reviewedBy = req.user?._id;
    request.reviewedAt = new Date();
    request.reviewNote = note;
    await request.save();

    const updated = await ApprovalRequest.findById(id)
      .populate('requestedBy', 'firstName lastName email')
      .populate('reviewedBy', 'firstName lastName email');

    res.json({ message: 'Request rejected', data: updated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
