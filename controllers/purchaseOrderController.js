const PurchaseOrder = require('../models/PurchaseOrder');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const BankAccount = require('../models/BankAccount');
const { createPurchaseFromPayload } = require('../services/approvalExecutionService');

const isAdminUser = (user) =>
  Array.isArray(user?.roles) &&
  user.roles.some((role) => (typeof role === 'string' ? role : role?.name)?.toLowerCase() === 'admin');

exports.createPurchaseOrder = async (req, res) => {
  try {
    const { supplierName, supplierContact, date, items_list, bankAccount } = req.body;

    if (!supplierName || !Array.isArray(items_list) || items_list.length === 0) {
      return res.status(400).json({ error: 'supplierName and non-empty items_list are required' });
    }

    let totalAmount = 0;
    const normalizedItems = [];

    let selectedBankAccount = null;
    if (bankAccount) {
      selectedBankAccount = await BankAccount.findById(bankAccount);
      if (!selectedBankAccount) return res.status(404).json({ error: 'Selected bank account not found' });
      if (selectedBankAccount.status !== 'active') {
        return res.status(400).json({ error: 'Selected bank account is inactive' });
      }
    }

    for (const item of items_list) {
      const qty = Number(item.quantity);
      const unitCost = Number(item.unitCost);

      if (!item.product || !item.warehouse || !qty || qty <= 0 || unitCost < 0) {
        return res.status(400).json({ error: 'Each item needs product, warehouse, quantity, and unitCost' });
      }

      const [product, warehouse] = await Promise.all([
        Product.findById(item.product),
        Warehouse.findById(item.warehouse),
      ]);

      if (!product) return res.status(404).json({ error: 'Product not found in items_list' });
      if (!warehouse) return res.status(404).json({ error: 'Warehouse not found in items_list' });

      const lineTotal = Number((qty * unitCost).toFixed(2));
      totalAmount += lineTotal;

      normalizedItems.push({
        product: item.product,
        warehouse: item.warehouse,
        quantity: qty,
        unitCost,
        lineTotal,
      });
    }

    const po = await PurchaseOrder.create({
      supplierName,
      supplierContact: supplierContact || '',
      date: date || new Date(),
      items_list: normalizedItems,
      total_amount: Number(totalAmount.toFixed(2)),
      bankAccount: selectedBankAccount?._id || null,
      status: 'ordered',
      createdBy: req.user?._id,
    });

    const populated = await PurchaseOrder.findById(po._id)
      .populate('items_list.product', 'name')
      .populate('items_list.warehouse', 'name')
      .populate('bankAccount', 'name accountNumber')
      .populate('createdBy', 'firstName lastName email');

    res.status(201).json({ data: populated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPurchaseOrders = async (req, res) => {
  try {
    const { status, supplierName, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status) query.status = status;
    if (supplierName) query.supplierName = { $regex: supplierName, $options: 'i' };

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const [orders, total] = await Promise.all([
      PurchaseOrder.find(query)
        .populate('items_list.product', 'name')
        .populate('items_list.warehouse', 'name')
        .populate('bankAccount', 'name accountNumber')
        .populate('createdBy', 'firstName lastName email')
        .populate('receivedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      PurchaseOrder.countDocuments(query),
    ]);

    res.json({ data: orders, total, page: pageNum, limit: limitNum });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPurchaseOrderById = async (req, res) => {
  try {
    const po = await PurchaseOrder.findById(req.params.id)
      .populate('items_list.product', 'name')
      .populate('items_list.warehouse', 'name')
      .populate('bankAccount', 'name accountNumber')
      .populate('createdBy', 'firstName lastName email')
      .populate('receivedBy', 'firstName lastName email')
      .populate('convertedPurchase');

    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    res.json({ data: po });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updatePurchaseOrderStatus = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Only admin can update purchase order status' });
    }

    const { status, bankAccount } = req.body;
    const allowed = ['draft', 'ordered', 'received', 'cancelled'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid purchase order status' });
    }

    const po = await PurchaseOrder.findById(req.params.id);
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });

    if (po.status === 'received' || po.status === 'cancelled') {
      return res.status(400).json({ error: `Cannot transition purchase order from ${po.status}` });
    }

    let selectedBankAccountId = po.bankAccount || null;
    if (bankAccount) {
      const selectedBankAccount = await BankAccount.findById(bankAccount);
      if (!selectedBankAccount) return res.status(404).json({ error: 'Selected bank account not found' });
      if (selectedBankAccount.status !== 'active') {
        return res.status(400).json({ error: 'Selected bank account is inactive' });
      }
      selectedBankAccountId = selectedBankAccount._id;
      po.bankAccount = selectedBankAccount._id;
    }

    if (status === 'received') {
      if (!selectedBankAccountId) {
        return res.status(400).json({ error: 'Bank account is required to receive purchase order' });
      }

      const createdPurchase = await createPurchaseFromPayload(
        {
          supplier: po.supplierName,
          date: po.date,
          items_list: po.items_list.map((item) => ({
            product: item.product,
            warehouse: item.warehouse,
            quantity: item.quantity,
            unitCost: item.unitCost,
          })),
          bankAccount: selectedBankAccountId,
        },
        req.user?._id
      );

      po.status = 'received';
      po.receivedAt = new Date();
      po.receivedBy = req.user?._id;
      po.convertedPurchase = createdPurchase?._id || null;
      await po.save();

      const populated = await PurchaseOrder.findById(po._id)
        .populate('items_list.product', 'name')
        .populate('items_list.warehouse', 'name')
        .populate('createdBy', 'firstName lastName email')
        .populate('receivedBy', 'firstName lastName email')
        .populate('convertedPurchase');

      return res.json({
        message: 'Purchase order received and converted to stock-in purchase',
        data: populated,
      });
    }

    po.status = status;
    await po.save();

    const populated = await PurchaseOrder.findById(po._id)
      .populate('items_list.product', 'name')
      .populate('items_list.warehouse', 'name')
      .populate('bankAccount', 'name accountNumber')
      .populate('bankAccount', 'name accountNumber')
      .populate('createdBy', 'firstName lastName email')
      .populate('receivedBy', 'firstName lastName email')
      .populate('convertedPurchase');

    res.json({ data: populated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
