    const Warehouse = require('../models/Warehouse');

    exports.createWarehouse = async (req, res) => {
    try {
            const warehouse = await Warehouse.create({ ...req.body, status: req.body.status || 'inactive' });
        res.status(201).json(warehouse);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
    };

    exports.getWarehouses = async (req, res) => {
    try {
            const { status } = req.query;
            const query = {};

            if (status) {
                query.status = status;
            }

        const hasPagination = typeof req.query.page !== 'undefined' || typeof req.query.limit !== 'undefined';
        if (!hasPagination) {
            const warehouses = await Warehouse.find(query).sort({ createdAt: -1 });
        return res.json(warehouses);
        }

        const { page = 1, limit = 10 } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;

        const [warehouses, total] = await Promise.all([
        Warehouse.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
        Warehouse.countDocuments(query),
        ]);

        res.json({ data: warehouses, total, page: pageNum, limit: limitNum });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
    };

    exports.updateWarehouse = async (req, res) => {
    try {
        const warehouse = await Warehouse.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!warehouse) return res.status(404).json({ error: 'Warehouse not found' });
        res.json(warehouse);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
    };

    exports.deleteWarehouse = async (req, res) => {
    try {
        const warehouse = await Warehouse.findByIdAndDelete(req.params.id);
        if (!warehouse) return res.status(404).json({ error: 'Warehouse not found' });
        res.json({ message: 'Warehouse deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
    };

    exports.activateWarehouse = async (req, res) => {
    try {
        const warehouse = await Warehouse.findByIdAndUpdate(req.params.id, { status: 'active' }, { new: true });
        if (!warehouse) return res.status(404).json({ error: 'Warehouse not found' });
        res.json({ message: 'Warehouse activated', data: warehouse });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
    };

    exports.deactivateWarehouse = async (req, res) => {
    try {
        const warehouse = await Warehouse.findByIdAndUpdate(req.params.id, { status: 'inactive' }, { new: true });
        if (!warehouse) return res.status(404).json({ error: 'Warehouse not found' });
        res.json({ message: 'Warehouse deactivated', data: warehouse });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
    };
