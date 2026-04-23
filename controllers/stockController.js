const Inventory = require('../models/Inventory');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const StockTransaction = require('../models/StockTransaction');
const ApprovalRequest = require('../models/ApprovalRequest');

const isAdminUser = (user) =>
  Array.isArray(user?.roles) &&
  user.roles.some((role) => (typeof role === 'string' ? role : role?.name)?.toLowerCase() === 'admin');

const ensureProductAndWarehouse = async (productId, warehouseId) => {
  const [product, warehouse] = await Promise.all([
    Product.findById(productId),
    Warehouse.findById(warehouseId),
  ]);

  if (!product) {
    const error = new Error('Product not found');
    error.status = 404;
    throw error;
  }
  if (product.status === 'inactive') {
    const error = new Error('Product is inactive. Activate it before stock operations.');
    error.status = 400;
    throw error;
  }

  if (!warehouse) {
    const error = new Error('Warehouse not found');
    error.status = 404;
    throw error;
  }
  if (warehouse.status === 'inactive') {
    const error = new Error('Warehouse is inactive. Activate it before stock operations.');
    error.status = 400;
    throw error;
  }
};

exports.stockIn = async (req, res) => {
  try {
    const { productId, warehouseId, quantity, note } = req.body;
    const qty = Number(quantity);

    if (!productId || !warehouseId || !qty || qty <= 0) {
      return res
        .status(400)
        .json({ error: 'productId, warehouseId and positive quantity are required' });
    }

    if (!isAdminUser(req.user)) {
      const approval = await ApprovalRequest.create({
        actionType: 'create_stock_in',
        payload: req.body,
        requestedBy: req.user?._id,
        status: 'pending',
      });

      return res.status(202).json({
        message: 'Stock in request sent for admin approval',
        status: 'pending_approval',
        requestId: approval._id,
      });
    }

    await ensureProductAndWarehouse(productId, warehouseId);

    const inventory = await Inventory.findOneAndUpdate(
      { product: productId, warehouse: warehouseId },
      { $inc: { quantity: qty } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await Product.findByIdAndUpdate(productId, { $inc: { quantity: qty } });

    await StockTransaction.create({
      type: 'in',
      quantity: qty,
      product: productId,
      warehouse: warehouseId,
      note: note || '',
      createdBy: req.user?._id,
    });

    res.status(201).json({ data: inventory });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

exports.stockOut = async (req, res) => {
  try {
    const { productId, warehouseId, quantity, note } = req.body;
    const qty = Number(quantity);

    if (!productId || !warehouseId || !qty || qty <= 0) {
      return res
        .status(400)
        .json({ error: 'productId, warehouseId and positive quantity are required' });
    }

    if (!isAdminUser(req.user)) {
      const approval = await ApprovalRequest.create({
        actionType: 'create_stock_out',
        payload: req.body,
        requestedBy: req.user?._id,
        status: 'pending',
      });

      return res.status(202).json({
        message: 'Stock out request sent for admin approval',
        status: 'pending_approval',
        requestId: approval._id,
      });
    }

    await ensureProductAndWarehouse(productId, warehouseId);

    const inventory = await Inventory.findOne({ product: productId, warehouse: warehouseId });
    if (!inventory || inventory.quantity < qty) {
      return res.status(400).json({ error: 'Insufficient stock for stock-out operation' });
    }

    const product = await Product.findById(productId);
    if (!product || product.quantity < qty) {
      return res.status(400).json({ error: 'Insufficient product stock for stock-out operation' });
    }

    inventory.quantity -= qty;
    await inventory.save();

    await Product.findByIdAndUpdate(productId, { $inc: { quantity: -qty } });

    await StockTransaction.create({
      type: 'out',
      quantity: qty,
      product: productId,
      warehouse: warehouseId,
      note: note || '',
      createdBy: req.user?._id,
    });

    res.json({ data: inventory });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
};

exports.getInventory = async (req, res) => {
  try {
    const { productId, warehouseId } = req.query;
    const query = {};

    if (productId) query.product = productId;
    if (warehouseId) query.warehouse = warehouseId;

    const inventories = await Inventory.find(query)
      .populate('product', 'name')
      .populate('warehouse', 'name address')
      .sort({ updatedAt: -1 });

    const validInventories = inventories.filter(
      (row) => row.product && row.warehouse && Number(row.quantity) > 0
    );

    res.json({ data: validInventories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getStockTransactions = async (req, res) => {
  try {
    const { productId, warehouseId, type } = req.query;
    const query = {};

    if (productId) query.product = productId;
    if (warehouseId) query.warehouse = warehouseId;
    if (type) query.type = type;

    const tx = await StockTransaction.find(query)
      .populate('product', 'name')
      .populate('warehouse', 'name')
      .populate('transfer', 'status')
      .populate('sale', 'customer total_amount')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({ data: tx });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
