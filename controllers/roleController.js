    const Role = require('../models/Role');
    const User = require('../models/User');
    const Permission = require('../models/Permission');
    const mongoose = require('mongoose');

    exports.getRoles = async (req, res) => {
    try {
        console.log('Fetching all roles');
        const hasPagination = typeof req.query.page !== 'undefined' || typeof req.query.limit !== 'undefined';
        if (!hasPagination) {
        const roles = await Role.find().sort({ createdAt: -1 });
        console.log('Returning roles:', roles.length);
        return res.json({ data: roles });
        }

        const { page = 1, limit = 10 } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;

        const [roles, total] = await Promise.all([
        Role.find().sort({ createdAt: -1 }).skip(skip).limit(limitNum),
        Role.countDocuments(),
        ]);
        console.log('Returning roles:', roles.length);
        res.json({ data: roles, total, page: pageNum, limit: limitNum });
    } catch (error) {
        console.error('Get roles error:', { message: error.message, stack: error.stack });
        res.status(500).json({ error: 'Server error' });
    }
    };

    exports.getRole = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: 'Invalid role ID' });
        }

        const role = await Role.findById(req.params.id);
        if (!role) {
        return res.status(404).json({ error: 'Role not found' });
        }

        res.json({ data: role });
    } catch (error) {
        console.error('Get role error:', { message: error.message, stack: error.stack });
        res.status(500).json({ error: 'Server error' });
    }
    };

    exports.createRole = async (req, res) => {
    try {
    const { name, permissions, status } = req.body;
        console.log('Creating role:', { name, permissions });
        if (!name) {
        console.error('Validation failed: name is required');
        return res.status(400).json({ error: 'Role name is required' });
        }
        const existingRole = await Role.findOne({ name });
        if (existingRole) {
        console.error('Role already exists:', name);
        return res.status(400).json({ error: 'Role already exists' });
        }
        if (typeof permissions !== 'undefined' && !Array.isArray(permissions)) {
        return res.status(400).json({ error: 'permissions must be an array' });
        }
        if (Array.isArray(permissions)) {
        const validPermissions = await Permission.find({ _id: { $in: permissions }, status: 'active' }).select('_id');
        if (permissions.length && validPermissions.length !== permissions.length) {
            return res.status(400).json({ error: 'One or more permissions are invalid' });
        }
        }
    const role = new Role({ name, permissions: Array.isArray(permissions) ? permissions : [], status: status || 'inactive' });
        await role.save();
        console.log('Create role response:', { data: role });
        res.json({ data: role });
    } catch (error) {
        console.error('Create role error:', { message: error.message, stack: error.stack });
        res.status(500).json({ error: 'Server error' });
    }
    };

    exports.updateRole = async (req, res) => {
    try {
        console.log('Updating role:', { id: req.params.id });
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        console.error('Invalid role ID:', req.params.id);
        return res.status(400).json({ error: 'Invalid role ID' });
        }
    const { name, permissions, status } = req.body;
        if (typeof permissions !== 'undefined' && !Array.isArray(permissions)) {
        return res.status(400).json({ error: 'permissions must be an array' });
        }
        if (Array.isArray(permissions)) {
    const validPermissions = await Permission.find({ _id: { $in: permissions }, status: 'active' }).select('_id');
    if (permissions.length && validPermissions.length !== permissions.length) {
        return res.status(400).json({ error: 'One or more permissions are invalid' });
    }
    }
        const updateFields = { name, updatedAt: new Date() };
        if (Array.isArray(permissions)) {
        updateFields.permissions = permissions;
        }
    if (typeof status !== 'undefined') updateFields.status = status;
    const role = await Role.findByIdAndUpdate(
    req.params.id,
    updateFields,
    { new: true }
    );
        if (!role) {
        console.error('Role not found:', req.params.id);
        return res.status(404).json({ error: 'Role not found' });
        }
        console.log('Update role response:', { data: role });
        res.json({ data: role });
    } catch (error) {
        console.error('Update role error:', { message: error.message, stack: error.stack });
        res.status(500).json({ error: 'Server error' });
    }
    };

    exports.deleteRole = async (req, res) => {
    try {
        console.log('Deleting role:', req.params.id);
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        console.error('Invalid role ID:', req.params.id);
        return res.status(400).json({ error: 'Invalid role ID' });
        }
        const role = await Role.findByIdAndDelete(req.params.id);
        if (!role) {
        console.error('Role not found:', req.params.id);
        return res.status(404).json({ error: 'Role not found' });
        }
        console.log('Delete role response:', { message: 'Role deleted' });
        res.json({ message: 'Role deleted' });
    } catch (error) {
        console.error('Delete role error:', { message: error.message, stack: error.stack });
        res.status(500).json({ error: 'Server error' });
    }
    };

    exports.activateRole = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: 'Invalid role ID' });
        }
        const role = await Role.findByIdAndUpdate(req.params.id, { status: 'active' }, { new: true });
        if (!role) return res.status(404).json({ error: 'Role not found' });
        res.json({ message: 'Role activated', data: role });
    } catch (error) {
        console.error('Activate role error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
    };

    exports.deactivateRole = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ error: 'Invalid role ID' });
        }
        const role = await Role.findByIdAndUpdate(req.params.id, { status: 'inactive' }, { new: true });
        if (!role) return res.status(404).json({ error: 'Role not found' });
        res.json({ message: 'Role deactivated', data: role });
    } catch (error) {
        console.error('Deactivate role error:', error.message);
        res.status(500).json({ error: 'Server error' });
    }
    };

    exports.assignRole = async (req, res) => {
    try {
        const { userId, roleName, permissions } = req.body;
        console.log('Received assign role request:', { userId, roleName, permissions });

        // Validate input
        if (!userId || !roleName) {
        console.error('Validation failed: userId or roleName missing');
        return res.status(400).json({ error: 'userId and roleName are required' });
        }

        // Validate userId format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.error('Invalid userId format:', userId);
        return res.status(400).json({ error: 'Invalid userId format' });
        }

        // Find role
        const role = await Role.findOne({ name: roleName });
        if (!role) {
        console.error('Role not found for roleName:', roleName);
        return res.status(404).json({ error: 'Role not found' });
        }

        // Find and update user
        const user = await User.findByIdAndUpdate(
        userId,
        { $addToSet: { roles: role._id } },
        { new: true }
        );
        if (!user) {
        console.error('User not found for userId:', userId);
        return res.status(404).json({ error: 'User not found' });
        }

        // Update role permissions if provided
        if (permissions && Array.isArray(permissions)) {
        const validPermissions = await Permission.find({ _id: { $in: permissions }, status: 'active' }).select('_id');
        if (permissions.length && validPermissions.length !== permissions.length) {
            return res.status(400).json({ error: 'One or more permissions are invalid' });
        }
        role.permissions = permissions;
        await role.save();
        }

        console.log('Role assigned successfully:', { userId, roleName, roles: user.roles });
        res.json({ data: { userId, roleName, roles: user.roles } });
    } catch (error) {
        console.error('Assign role error:', {
        message: error.message,
        stack: error.stack,
        userId: req.body.userId,
        roleName: req.body.roleName
        });
        res.status(500).json({ error: 'Server error' });
    }
    };

    exports.removeRole = async (req, res) => {
    try {
        const { userId, roleName } = req.body;
        console.log('Received remove role request:', { userId, roleName });

        // Validate input
        if (!userId || !roleName) {
        console.error('Validation failed: userId or roleName missing');
        return res.status(400).json({ error: 'userId and roleName are required' });
        }

        // Validate userId format
        if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.error('Invalid userId format:', userId);
        return res.status(400).json({ error: 'Invalid userId format' });
        }

        // Find role
        const role = await Role.findOne({ name: roleName });
        if (!role) {
        console.error('Role not found for roleName:', roleName);
        return res.status(404).json({ error: 'Role not found' });
        }

        // Find and update user
        const user = await User.findByIdAndUpdate(
        userId,
        { $pull: { roles: role._id } },
        { new: true }
        );
        if (!user) {
        console.error('User not found for userId:', userId);
        return res.status(404).json({ error: 'User not found' });
        }

        console.log('Role removed successfully:', { userId, roleName, roles: user.roles });
        res.json({ data: { userId, roleName, roles: user.roles } });
    } catch (error) {
        console.error('Remove role error:', {
        message: error.message,
        stack: error.stack,
        userId: req.body.userId,
        roleName: req.body.roleName
        });
        res.status(500).json({ error: 'Server error' });
    }
    };