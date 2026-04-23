const Product = require('../models/Product');
const Category = require('../models/Category');
const Unit = require('../models/Unit');
const Inventory = require('../models/Inventory');
const ApprovalRequest = require('../models/ApprovalRequest');
const { createProductFromPayload } = require('../services/approvalExecutionService');

const isAdminUser = (user) =>
  Array.isArray(user?.roles) &&
  user.roles.some((role) => (typeof role === 'string' ? role : role?.name)?.toLowerCase() === 'admin');


exports.createProduct = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      const approval = await ApprovalRequest.create({
        actionType: 'create_product',
        payload: req.body,
        requestedBy: req.user?._id,
        status: 'pending',
      });

      return res.status(202).json({
        message: 'Product creation request sent for admin approval',
        status: 'pending_approval',
        requestId: approval._id,
      });
    }

    const product = await createProductFromPayload(req.body, req.user?._id);
    res.status(201).json({ data: product });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const { search = '', category, unit, status } = req.query;
    const query = {};

    if (category) query.category = category;
    if (unit) query.unit = unit;
    if (status) query.status = status;

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const hasPagination = typeof req.query.page !== 'undefined' || typeof req.query.limit !== 'undefined';
    if (!hasPagination) {
      const products = await Product.find(query)
        .populate('category', 'name code')
        .populate('unit', 'name abbreviation')
        .populate('createdBy', 'firstName lastName email')
        .sort({ createdAt: -1 });

      return res.json({ data: products, total: products.length, page: 1, limit: products.length || 1 });
    }

    const { page = 1, limit = 20 } = req.query;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category', 'name code')
        .populate('unit', 'name abbreviation')
        .populate('createdBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Product.countDocuments(query),
    ]);

    res.json({ data: products, total, page: pageNum, limit: limitNum });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name code')
      .populate('unit', 'name abbreviation')
      .populate('createdBy', 'firstName lastName email');

    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ data: product });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { category, unit } = req.body;

    if (category) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists) return res.status(404).json({ error: 'Category not found' });
    }

    if (unit) {
      const unitExists = await Unit.findById(unit);
      if (!unitExists) return res.status(404).json({ error: 'Unit not found' });
    }

    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate('category', 'name code')
      .populate('unit', 'name abbreviation')
      .populate('createdBy', 'firstName lastName email');

    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ data: product });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Remove leftover inventory rows for deleted products so stock page stays consistent.
    await Inventory.deleteMany({ product: req.params.id });

    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.activateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status: 'active' },
      { new: true }
    ).populate('category', 'name code').populate('unit', 'name abbreviation');
    if (product) await product.populate('createdBy', 'firstName lastName email');

    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product activated', data: product });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.deactivateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status: 'inactive' },
      { new: true }
    ).populate('category', 'name code').populate('unit', 'name abbreviation');
    if (product) await product.populate('createdBy', 'firstName lastName email');

    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deactivated', data: product });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
