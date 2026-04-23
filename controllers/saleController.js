const Sale = require('../models/Sale');
const ApprovalRequest = require('../models/ApprovalRequest');
const Inventory = require('../models/Inventory');
const Warehouse = require('../models/Warehouse');
const mongoose = require('mongoose');
const { createSaleFromPayload } = require('../services/approvalExecutionService');

const isAdminUser = (user) =>
  Array.isArray(user?.roles) &&
  user.roles.some((role) => (typeof role === 'string' ? role : role?.name)?.toLowerCase() === 'admin');

exports.createSale = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      const approval = await ApprovalRequest.create({
        actionType: 'create_sale',
        payload: req.body,
        requestedBy: req.user?._id,
        status: 'pending',
      });

      return res.status(202).json({
        message: 'Sale request sent for admin approval',
        status: 'pending_approval',
        requestId: approval._id,
      });
    }

    const populatedSale = await createSaleFromPayload(req.body, req.user?._id);
    res.status(201).json({ data: populatedSale });
  } catch (error) {
    const message = String(error?.message || 'Failed to create sale');
    const isValidationError =
      message.toLowerCase().includes('required') ||
      message.toLowerCase().includes('insufficient') ||
      message.toLowerCase().includes('not found') ||
      message.toLowerCase().includes('inactive') ||
      message.toLowerCase().includes('non-empty');

    res.status(isValidationError ? 400 : 500).json({ error: message });
  }
};

exports.getSales = async (req, res) => {
  try {
    const { customer, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};

    if (customer) query.customer = { $regex: customer, $options: 'i' };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const [sales, total] = await Promise.all([
      Sale.find(query)
        .populate('items_list.product', 'name')
        .populate('items_list.warehouse', 'name')
        .populate('createdBy', 'firstName lastName email')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limitNum),
      Sale.countDocuments(query),
    ]);

    res.json({ data: sales, total, page: pageNum, limit: limitNum });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSalesSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const match = {};

    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) match.date.$lte = new Date(endDate);
    }

    const summary = await Sale.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalSalesAmount: { $sum: { $sum: '$items_list.lineTotal' } },
          totalSalesUnits: { $sum: { $sum: '$items_list.quantity' } },
          totalTransactions: { $sum: 1 },
          averageSaleAmount: { $avg: { $sum: '$items_list.lineTotal' } },
        },
      },
    ]);

    res.json({
      data: summary[0] || {
        totalSalesAmount: 0,
        totalSalesUnits: 0,
        totalTransactions: 0,
        averageSaleAmount: 0,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAvailableSourceWarehouses = async (req, res) => {
  try {
    const { productId } = req.query;

    if (!productId) {
      return res.status(400).json({ error: 'productId is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid productId' });
    }

    const warehouses = await Inventory.aggregate([
      {
        $match: {
          product: new mongoose.Types.ObjectId(productId),
          quantity: { $gt: 0 },
        },
      },
      {
        $lookup: {
          from: Warehouse.collection.name,
          localField: 'warehouse',
          foreignField: '_id',
          as: 'warehouse',
        },
      },
      { $unwind: '$warehouse' },
      { $match: { 'warehouse.status': 'active' } },
      {
        $project: {
          _id: 0,
          warehouseId: '$warehouse._id',
          warehouseName: '$warehouse.name',
          quantity: 1,
        },
      },
      { $sort: { warehouseName: 1 } },
    ]);

    res.json({ data: warehouses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
