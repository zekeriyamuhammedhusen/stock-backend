const Purchase = require('../models/Purchase');
const ApprovalRequest = require('../models/ApprovalRequest');
const { createPurchaseFromPayload } = require('../services/approvalExecutionService');

const isAdminUser = (user) =>
  Array.isArray(user?.roles) &&
  user.roles.some((role) => (typeof role === 'string' ? role : role?.name)?.toLowerCase() === 'admin');

exports.createPurchase = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      const approval = await ApprovalRequest.create({
        actionType: 'create_purchase',
        payload: req.body,
        requestedBy: req.user?._id,
        status: 'pending',
      });

      return res.status(202).json({
        message: 'Purchase request sent for admin approval',
        status: 'pending_approval',
        requestId: approval._id,
      });
    }

    const populated = await createPurchaseFromPayload(req.body, req.user?._id);
    res.status(201).json({ data: populated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPurchases = async (req, res) => {
  try {
    const { supplier, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};

    if (supplier) query.supplier = { $regex: supplier, $options: 'i' };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const [purchases, total] = await Promise.all([
      Purchase.find(query)
        .populate('items_list.product', 'name')
        .populate('items_list.warehouse', 'name')
        .populate('createdBy', 'firstName lastName email')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limitNum),
      Purchase.countDocuments(query),
    ]);

    res.json({ data: purchases, total, page: pageNum, limit: limitNum });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
