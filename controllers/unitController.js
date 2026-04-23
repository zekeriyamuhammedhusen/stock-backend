    const Unit = require('../models/Unit');

    exports.createUnit = async (req, res) => {
    try {
            const unit = await Unit.create({ ...req.body, status: req.body.status || 'inactive' });
        res.status(201).json(unit);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
    };

    exports.getUnits = async (req, res) => {
    try {
            const { status } = req.query;
            const query = {};

            if (status) {
                query.status = status;
            }

        const hasPagination = typeof req.query.page !== 'undefined' || typeof req.query.limit !== 'undefined';
        if (!hasPagination) {
            const units = await Unit.find(query).sort({ createdAt: -1 });
        return res.json(units);
        }

        const { page = 1, limit = 10 } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;

        const [units, total] = await Promise.all([
        Unit.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
        Unit.countDocuments(query),
        ]);

        res.json({ data: units, total, page: pageNum, limit: limitNum });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
    };

    exports.updateUnit = async (req, res) => {
    try {
        const unit = await Unit.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!unit) return res.status(404).json({ error: 'Unit not found' });
        res.json(unit);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
    };

    exports.deleteUnit = async (req, res) => {
    try {
        const unit = await Unit.findByIdAndDelete(req.params.id);
        if (!unit) return res.status(404).json({ error: 'Unit not found' });
        res.json({ message: 'Unit deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
    };

    exports.activateUnit = async (req, res) => {
    try {
        const unit = await Unit.findByIdAndUpdate(req.params.id, { status: 'active' }, { new: true });
        if (!unit) return res.status(404).json({ error: 'Unit not found' });
        res.json({ message: 'Unit activated', data: unit });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
    };

    exports.deactivateUnit = async (req, res) => {
    try {
        const unit = await Unit.findByIdAndUpdate(req.params.id, { status: 'inactive' }, { new: true });
        if (!unit) return res.status(404).json({ error: 'Unit not found' });
        res.json({ message: 'Unit deactivated', data: unit });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
    };
