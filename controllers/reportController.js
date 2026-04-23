const mongoose = require('mongoose');
const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Purchase = require('../models/Purchase');
const StockTransaction = require('../models/StockTransaction');

const isAdminUser = (user) =>
  Array.isArray(user?.roles)
  && user.roles.some((role) => String(role?.name || '').toLowerCase() === 'admin');

exports.getLowStockReport = async (req, res) => {
  try {
    const threshold = Number(req.query.threshold || 0);

    const lowStockItems = await Inventory.aggregate([
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $lookup: {
          from: 'warehouses',
          localField: 'warehouse',
          foreignField: '_id',
          as: 'warehouse',
        },
      },
      { $unwind: '$warehouse' },
      {
        $match: {
          $expr: {
            $lte: [
              '$quantity',
              threshold > 0 ? threshold : { $ifNull: ['$product.reorderLevel', 10] },
            ],
          },
        },
      },
      {
        $project: {
          _id: 1,
          quantity: 1,
          productId: '$product._id',
          productName: '$product.name',
          reorderLevel: { $ifNull: ['$product.reorderLevel', 10] },
          warehouseId: '$warehouse._id',
          warehouseName: '$warehouse.name',
        },
      },
      { $sort: { quantity: 1 } },
    ]);

    res.json({ data: lowStockItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProfitLossReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const adminUser = isAdminUser(req.user);
    const dateMatch = {};

    if (startDate) dateMatch.$gte = new Date(startDate);
    if (endDate) dateMatch.$lte = new Date(endDate);

    const match = Object.keys(dateMatch).length ? { date: dateMatch } : {};
    if (!adminUser) {
      match.createdBy = req.user._id;
    }

    const [profitAgg, purchaseAgg, salesCountAgg] = await Promise.all([
      Sale.aggregate([
        { $match: match },
        {
          $unwind: '$items_list',
        },
        {
          $lookup: {
            from: 'products',
            localField: 'items_list.product',
            foreignField: '_id',
            as: 'productData',
          },
        },
        {
          $unwind: '$productData',
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$items_list.lineTotal' },
            totalCost: {
              $sum: {
                $multiply: [
                  '$items_list.quantity',
                  { $ifNull: ['$productData.costPrice', 0] },
                ],
              },
            },
            salesUnits: { $sum: '$items_list.quantity' },
          },
        },
      ]),
      Purchase.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            expense: { $sum: { $sum: '$items_list.lineTotal' } },
            purchaseUnits: { $sum: { $sum: '$items_list.quantity' } },
          },
        },
      ]),
      Sale.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            salesCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const revenue = profitAgg[0]?.revenue || 0;
    const totalCost = profitAgg[0]?.totalCost || 0;
    const actualProfit = Number((revenue - totalCost).toFixed(2));
    const expense = purchaseAgg[0]?.expense || 0;

    res.json({
      data: {
        revenue,
        totalCostOfGoodsSold: totalCost,
        profit: actualProfit,
        salesCount: salesCountAgg[0]?.salesCount || 0,
        salesUnits: profitAgg[0]?.salesUnits || 0,
        purchaseCount: (await Purchase.countDocuments(match)) || 0,
        purchaseUnits: purchaseAgg[0]?.purchaseUnits || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDashboardMetrics = async (req, res) => {
  try {
    const adminUser = isAdminUser(req.user);
    const salesMatch = adminUser ? {} : { createdBy: req.user._id };
    const recentTransactionsFilter = adminUser ? {} : { createdBy: req.user._id };
    const [salesAgg, stockValueAgg, recentTransactions] = await Promise.all([
      Sale.aggregate([
        ...(Object.keys(salesMatch).length ? [{ $match: salesMatch }] : []),
        {
          $group: {
            _id: null,
            totalSales: { $sum: { $sum: '$items_list.lineTotal' } },
            totalSalesTransactions: { $sum: 1 },
            totalSalesUnits: { $sum: { $sum: '$items_list.quantity' } },
          },
        },
      ]),
      adminUser
        ? Inventory.aggregate([
          {
            $lookup: {
              from: 'products',
              localField: 'product',
              foreignField: '_id',
              as: 'product',
            },
          },
          { $unwind: '$product' },
          {
            $lookup: {
              from: 'warehouses',
              localField: 'warehouse',
              foreignField: '_id',
              as: 'warehouse',
            },
          },
          { $unwind: '$warehouse' },
          {
            $match: {
              quantity: { $gt: 0 },
              'product.status': 'active',
              'warehouse.status': 'active',
            },
          },
          {
            $group: {
              _id: null,
              currentStockValue: {
                $sum: {
                  $multiply: ['$quantity', { $ifNull: ['$product.costPrice', 0] }],
                },
              },
              totalStockUnits: { $sum: '$quantity' },
            },
          },
        ])
        : Promise.resolve([]),
      StockTransaction.find(recentTransactionsFilter)
        .populate('product', 'name')
        .populate('warehouse', 'name')
        .populate('createdBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

    res.json({
      data: {
        totalSales: salesAgg[0]?.totalSales || 0,
        totalSalesTransactions: salesAgg[0]?.totalSalesTransactions || 0,
        totalSalesUnits: salesAgg[0]?.totalSalesUnits || 0,
        currentStockValue: adminUser
          ? Number((stockValueAgg[0]?.currentStockValue || 0).toFixed(2))
          : 0,
        totalStockUnits: Math.round(stockValueAgg[0]?.totalStockUnits || 0),
        adminStockMetricsVisible: adminUser,
        recentTransactions,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate, productId, salespersonId } = req.query;
    const adminUser = isAdminUser(req.user);
    const match = {};

    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) match.date.$lte = new Date(endDate);
    }
    if (adminUser && salespersonId) {
      match.createdBy = salespersonId;
    }
    if (!adminUser) {
      match.createdBy = req.user._id;
    }

    const pipeline = [
      { $match: match },
      { $unwind: '$items_list' },
    ];

    if (productId) {
      if (!mongoose.Types.ObjectId.isValid(productId)) {
        return res.status(400).json({ error: 'Invalid productId' });
      }
      pipeline.push({ $match: { 'items_list.product': new mongoose.Types.ObjectId(productId) } });
    }

    pipeline.push(
      {
        $lookup: {
          from: 'products',
          localField: 'items_list.product',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'salesperson',
        },
      },
      { $unwind: { path: '$salesperson', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          saleId: '$_id',
          date: 1,
          customer: 1,
          salespersonId: '$salesperson._id',
          salesperson: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ['$salesperson.firstName', ''] },
                  ' ',
                  { $ifNull: ['$salesperson.lastName', ''] },
                ],
              },
            },
          },
          productId: '$product._id',
          productName: '$product.name',
          quantity: '$items_list.quantity',
          unitPrice: '$items_list.unitPrice',
          lineTotal: '$items_list.lineTotal',
        },
      },
      { $sort: { date: -1 } }
    );

    const rows = await Sale.aggregate(pipeline);
    const summary = rows.reduce(
      (acc, row) => {
        acc.totalQuantity += Number(row.quantity || 0);
        acc.totalAmount += Number(row.lineTotal || 0);
        acc.uniqueSales.add(String(row.saleId));
        return acc;
      },
      { totalQuantity: 0, totalAmount: 0, uniqueSales: new Set() }
    );

    res.json({
      data: rows,
      summary: {
        totalQuantity: summary.totalQuantity,
        totalAmount: Number(summary.totalAmount.toFixed(2)),
        totalTransactions: summary.uniqueSales.size,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSupplierPerformanceReport = async (req, res) => {
  try {
    const { startDate, endDate, supplier } = req.query;
    const adminUser = isAdminUser(req.user);
    const match = {};

    if (startDate || endDate) {
      match.date = {};
      if (startDate) match.date.$gte = new Date(startDate);
      if (endDate) match.date.$lte = new Date(endDate);
    }
    if (supplier) {
      match.supplier = { $regex: supplier, $options: 'i' };
    }
    if (!adminUser) {
      match.createdBy = req.user._id;
    }

    const report = await Purchase.aggregate([
      { $match: match },
      { $unwind: '$items_list' },
      {
        $group: {
          _id: '$supplier',
          totalOrders: { $addToSet: '$_id' },
          totalSpent: { $sum: '$items_list.lineTotal' },
          totalUnits: { $sum: '$items_list.quantity' },
          avgUnitCost: { $avg: '$items_list.unitCost' },
          lastPurchaseDate: { $max: '$date' },
        },
      },
      {
        $project: {
          _id: 0,
          supplier: '$_id',
          totalOrders: { $size: '$totalOrders' },
          totalSpent: { $round: ['$totalSpent', 2] },
          totalUnits: 1,
          avgUnitCost: { $round: ['$avgUnitCost', 2] },
          lastPurchaseDate: 1,
        },
      },
      { $sort: { totalSpent: -1 } },
    ]);

    res.json({ data: report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
