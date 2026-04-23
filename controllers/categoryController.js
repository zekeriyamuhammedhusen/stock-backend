    const Category = require('../models/Category');

    exports.createCategory = async (req, res) => {
    try {
            const category = await Category.create({ ...req.body, status: req.body.status || 'inactive' });
        res.status(201).json(category);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
    };

    exports.getCategories = async (req, res) => {
    try {
            const { status } = req.query;
            const query = {};

            if (status) {
                query.status = status;
            }

        const hasPagination = typeof req.query.page !== 'undefined' || typeof req.query.limit !== 'undefined';
        if (!hasPagination) {
            const categories = await Category.find(query).sort({ createdAt: -1 });
        return res.json(categories);
        }

        const { page = 1, limit = 10 } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;

        const [categories, total] = await Promise.all([
        Category.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
        Category.countDocuments(query),
        ]);

        res.json({ data: categories, total, page: pageNum, limit: limitNum });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
    };

    exports.updateCategory = async (req, res) => {
    try {
        const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!category) return res.status(404).json({ error: 'Category not found' });
        res.json(category);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
    };

    exports.deleteCategory = async (req, res) => {
    try {
        const category = await Category.findByIdAndDelete(req.params.id);
        if (!category) return res.status(404).json({ error: 'Category not found' });
        res.json({ message: 'Category deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
    };

    exports.activateCategory = async (req, res) => {
    try {
        const category = await Category.findByIdAndUpdate(req.params.id, { status: 'active' }, { new: true });
        if (!category) return res.status(404).json({ error: 'Category not found' });
        res.json({ message: 'Category activated', data: category });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
    };

    exports.deactivateCategory = async (req, res) => {
    try {
        const category = await Category.findByIdAndUpdate(req.params.id, { status: 'inactive' }, { new: true });
        if (!category) return res.status(404).json({ error: 'Category not found' });
        res.json({ message: 'Category deactivated', data: category });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
    };
