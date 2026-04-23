    // controllers/permissionController.js
    const Permission = require('../models/Permission');

    exports.getPermissions = async (req, res) => {
    try {
            const hasPagination = typeof req.query.page !== 'undefined' || typeof req.query.limit !== 'undefined';
            if (!hasPagination) {
                const permissions = await Permission.find().sort({ createdAt: -1 });
                console.log('Returning permissions:', permissions.length);
                return res.json({ data: permissions });
            }

            const { page = 1, limit = 10 } = req.query;
            const pageNum = Number(page);
            const limitNum = Number(limit);
            const skip = (pageNum - 1) * limitNum;

            const [permissions, total] = await Promise.all([
                Permission.find().sort({ createdAt: -1 }).skip(skip).limit(limitNum),
                Permission.countDocuments(),
            ]);
            console.log('Returning permissions:', permissions.length);
            res.json({ data: permissions, total, page: pageNum, limit: limitNum });
    } catch (error) {
        console.error('Get permissions error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
    };

    exports.getPermission = async (req, res) => {
    try {
        if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
        return res.status(400).json({ error: 'Invalid permission ID' });
        }

        const permission = await Permission.findById(req.params.id);
        if (!permission) {
        return res.status(404).json({ error: 'Permission not found' });
        }

        res.json({ data: permission });
    } catch (error) {
        console.error('Get permission error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
    };

    exports.createPermission = async (req, res) => {
    try {
    const { name, description, status } = req.body;
        if (!name) return res.status(400).json({ error: 'Permission name is required' });
        const existingPermission = await Permission.findOne({ name });
        if (existingPermission) return res.status(400).json({ error: 'Permission already exists' });
    const permission = new Permission({ name, description, status: status || 'inactive' });
        await permission.save();
        res.json({ data: permission });
    } catch (error) {
        console.error('Create permission error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
    };

    exports.updatePermission = async (req, res) => {
    try {
        if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
        return res.status(400).json({ error: 'Invalid permission ID' });
        }
    const { name, description, status } = req.body;
    console.log('UpdatePermission received status:', status);
    const updateFields = { name, description, updatedAt: new Date() };
    if (typeof status !== 'undefined') {
        updateFields.status = status === false || status === 'inactive' ? 'inactive' : 'active';
    }
    console.log('UpdatePermission saving fields:', updateFields);
    const permission = await Permission.findByIdAndUpdate(
        req.params.id,
        updateFields,
        { new: true }
    );
        if (!permission) return res.status(404).json({ error: 'Permission not found' });
        res.json({ data: permission });
    } catch (error) {
        console.error('Update permission error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
    };

    exports.deletePermission = async (req, res) => {
    try {
        if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
        return res.status(400).json({ error: 'Invalid permission ID' });
        }
        const permission = await Permission.findByIdAndDelete(req.params.id);
        if (!permission) return res.status(404).json({ error: 'Permission not found' });
        res.json({ message: 'Permission deleted' });
    } catch (error) {
        console.error('Delete permission error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
    };

    exports.activatePermission = async (req, res) => {
    try {
        if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
        return res.status(400).json({ error: 'Invalid permission ID' });
        }
        const permission = await Permission.findByIdAndUpdate(req.params.id, { status: 'active' }, { new: true });
        if (!permission) return res.status(404).json({ error: 'Permission not found' });
        res.json({ message: 'Permission activated', data: permission });
    } catch (error) {
        console.error('Activate permission error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
    };

    exports.deactivatePermission = async (req, res) => {
    try {
        if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
        return res.status(400).json({ error: 'Invalid permission ID' });
        }
        const permission = await Permission.findByIdAndUpdate(req.params.id, { status: 'inactive' }, { new: true });
        if (!permission) return res.status(404).json({ error: 'Permission not found' });
        res.json({ message: 'Permission deactivated', data: permission });
    } catch (error) {
        console.error('Deactivate permission error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
    };