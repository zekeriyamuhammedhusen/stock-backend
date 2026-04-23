const Transfer = require('../models/Transfer');
const Inventory = require('../models/Inventory');
const StockTransaction = require('../models/StockTransaction');
const Product = require('../models/Product');
const Warehouse = require('../models/Warehouse');
const ApprovalRequest = require('../models/ApprovalRequest');
const { createTransferFromPayload } = require('../services/approvalExecutionService');

const isAdminUser = (user) =>
  Array.isArray(user?.roles) &&
  user.roles.some((role) => (typeof role === 'string' ? role : role?.name)?.toLowerCase() === 'admin');

const allowedTransitions = {
  pending: ['in_transit', 'completed', 'cancelled'],
  in_transit: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

exports.createTransfer = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      const approval = await ApprovalRequest.create({
        actionType: 'create_transfer',
        payload: req.body,
        requestedBy: req.user?._id,
        status: 'pending',
      });

      return res.status(202).json({
        message: 'Transfer request sent for admin approval',
        status: 'pending_approval',
        requestId: approval._id,
      });
    }

    const { productId, sourceWarehouseId, destinationWarehouseId, quantity, note } = req.body;
    const qty = Number(quantity);

    if (!productId || !sourceWarehouseId || !destinationWarehouseId || !qty || qty <= 0) {
      return res.status(400).json({
        error:
          'productId, sourceWarehouseId, destinationWarehouseId and positive quantity are required',
      });
    }

    if (sourceWarehouseId === destinationWarehouseId) {
      return res.status(400).json({ error: 'Source and destination warehouses must differ' });
    }

    const [product, sourceWh, destinationWh] = await Promise.all([
      Product.findById(productId),
      Warehouse.findById(sourceWarehouseId),
      Warehouse.findById(destinationWarehouseId),
    ]);

    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (!sourceWh || !destinationWh) {
      return res.status(404).json({ error: 'Warehouse not found' });
    }
    if (product.status === 'inactive') {
      return res.status(400).json({ error: 'Product is inactive' });
    }
    if (sourceWh.status === 'inactive' || destinationWh.status === 'inactive') {
      return res.status(400).json({ error: 'Source or destination warehouse is inactive' });
    }

    const sourceInventory = await Inventory.findOne({ product: productId, warehouse: sourceWarehouseId });
    if (!sourceInventory || Number(sourceInventory.quantity || 0) < qty) {
      return res.status(400).json({
        error: 'Selected source warehouse does not have enough stock for this product',
      });
    }

    const populatedTransfer = await createTransferFromPayload(req.body, req.user?._id);

    res.status(201).json({
      data: populatedTransfer,
      message: 'Transfer request created. Complete it to move stock.',
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

    const warehouses = await Inventory.aggregate([
      { $match: { product: new (require('mongoose')).Types.ObjectId(productId), quantity: { $gt: 0 } } },
      {
        $lookup: {
          from: 'warehouses',
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

exports.getTransfers = async (req, res) => {
  try {
    const { status, productId, sourceWarehouseId, destinationWarehouseId } = req.query;
    const query = {};

    if (status) query.status = status;
    if (productId) query.product = productId;
    if (sourceWarehouseId) query.sourceWarehouse = sourceWarehouseId;
    if (destinationWarehouseId) query.destinationWarehouse = destinationWarehouseId;

    const transfers = await Transfer.find(query)
      .populate('product', 'name')
      .populate('sourceWarehouse', 'name')
      .populate('destinationWarehouse', 'name')
      .populate('createdBy', 'firstName lastName email')
      .populate('processedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({ data: transfers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateTransferStatus = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Only admin can update transfer status' });
    }

    const { status } = req.body;
    const allowed = ['pending', 'in_transit', 'completed', 'cancelled'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid transfer status' });
    }

    const transfer = await Transfer.findById(req.params.id)
      .populate('product', 'name quantity status')
      .populate('sourceWarehouse', 'name status')
      .populate('destinationWarehouse', 'name status');

    if (!transfer) return res.status(404).json({ error: 'Transfer not found' });

    const currentStatus = transfer.status;
    if (!allowedTransitions[currentStatus].includes(status)) {
      return res.status(400).json({
        error: `Invalid status transition from ${currentStatus} to ${status}`,
      });
    }

    if (status === 'completed') {
      const sourceInventory = await Inventory.findOne({
        product: transfer.product._id,
        warehouse: transfer.sourceWarehouse._id,
      });

      if (!sourceInventory || sourceInventory.quantity < transfer.quantity) {
        return res.status(400).json({ error: 'Insufficient stock in source warehouse to complete transfer' });
      }

      sourceInventory.quantity -= transfer.quantity;
      await sourceInventory.save();

      await Inventory.findOneAndUpdate(
        { product: transfer.product._id, warehouse: transfer.destinationWarehouse._id },
        { $inc: { quantity: transfer.quantity } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      await StockTransaction.insertMany([
        {
          type: 'transfer_out',
          quantity: transfer.quantity,
          product: transfer.product._id,
          warehouse: transfer.sourceWarehouse._id,
          transfer: transfer._id,
          note: transfer.note || '',
          createdBy: req.user?._id,
        },
        {
          type: 'transfer_in',
          quantity: transfer.quantity,
          product: transfer.product._id,
          warehouse: transfer.destinationWarehouse._id,
          transfer: transfer._id,
          note: transfer.note || '',
          createdBy: req.user?._id,
        },
      ]);
    }

    if (status === 'cancelled') {
      await Transfer.deleteOne({ _id: transfer._id });

      return res.json({
        message: 'Transfer cancelled and deleted successfully',
      });
    }

    transfer.status = status;
    transfer.processedAt = ['completed', 'cancelled'].includes(status) ? new Date() : null;
    transfer.processedBy = ['completed', 'cancelled'].includes(status) ? req.user?._id : null;
    await transfer.save();

    const populatedTransfer = await Transfer.findById(transfer._id)
      .populate('product', 'name')
      .populate('sourceWarehouse', 'name')
      .populate('destinationWarehouse', 'name')
      .populate('createdBy', 'firstName lastName email')
      .populate('processedBy', 'firstName lastName email');

    res.json({ data: populatedTransfer });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
