
    const User = require('../models/User');
    const Role = require('../models/Role');
    const Permission = require('../models/Permission');
    const bcrypt = require('bcryptjs');
    const jwt = require('jsonwebtoken');

    const createUser = async (req, res) => {
    try {
    const { firstName, middleName, lastName, phoneNumber, address, email, password, status, role, roles = [], permissions = [], isAdmin = false } = req.body;
        const existingUser = await User.findOne({ $or: [{ email }, { phoneNumber }] });
        if (existingUser) {
        return res.status(400).json({ error: 'Email or phone number already exists' });
        }

        let normalizedRole = role || roles?.[0] || null;
        if (isAdmin) {
        const adminRole = await Role.findOne({ name: 'Admin' }).select('_id');
        if (!adminRole) {
            return res.status(400).json({ error: 'Admin role not found' });
        }
        normalizedRole = adminRole._id.toString();
        }
        if (normalizedRole && !normalizedRole.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: 'Invalid role ID' });
        }

        if (!Array.isArray(permissions)) {
        return res.status(400).json({ error: 'permissions must be an array' });
        }

        const normalizedPermissions = isAdmin ? [] : permissions;

        const [validRoles, validPermissions] = await Promise.all([
        normalizedRole ? Role.find({ _id: normalizedRole }).select('_id') : [],
        Permission.find({ _id: { $in: normalizedPermissions }, status: 'active' }).select('_id'),
        ]);

        if (normalizedRole && validRoles.length !== 1) {
        return res.status(400).json({ error: 'Role is invalid' });
        }
        if (normalizedPermissions.length && validPermissions.length !== normalizedPermissions.length) {
        return res.status(400).json({ error: 'One or more permissions are invalid' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({
    firstName,
    middleName,
    lastName,
    phoneNumber,
    address,
    email,
    password: hashedPassword,
    roles: normalizedRole ? [normalizedRole] : [],
        permissions: normalizedPermissions,
    status: status || 'inactive',
        });
        await user.save();
        console.log('User saved:', user);
        res.status(201).json({ message: 'User created successfully', userId: user._id });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Server error' });
    }
    };

    const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
    const { firstName, middleName, lastName, address, status, role, roles, permissions } = req.body;
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: 'Invalid user ID' });
        }
        const user = await User.findById(id);
        if (!user) {
        return res.status(404).json({ error: 'User not found' });
        }
        user.firstName = firstName || user.firstName;
        user.middleName = middleName || user.middleName;
        user.lastName = lastName || user.lastName;
        user.address = address || user.address;
    if (typeof status !== 'undefined') user.status = status === false || status === 'inactive' ? 'inactive' : 'active';

    if (typeof role !== 'undefined' || typeof roles !== 'undefined') {
        const selectedRole = role || roles?.[0] || null;
        if (selectedRole && !selectedRole.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: 'Invalid role ID' });
        }
        if (selectedRole) {
        const validRole = await Role.findById(selectedRole).select('_id');
        if (!validRole) {
            return res.status(400).json({ error: 'Role is invalid' });
        }
        user.roles = [selectedRole];
        } else {
        user.roles = [];
        }
    }

    if (typeof permissions !== 'undefined') {
        if (!Array.isArray(permissions)) {
        return res.status(400).json({ error: 'permissions must be an array' });
        }
        const validPermissions = await Permission.find({ _id: { $in: permissions }, status: 'active' }).select('_id');
        if (permissions.length && validPermissions.length !== permissions.length) {
        return res.status(400).json({ error: 'One or more permissions are invalid' });
        }
        user.permissions = permissions;
    }

    await user.save();
        res.status(200).json({ message: 'User updated successfully' });
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Server error' });
    }
    };

    const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: 'Invalid user ID' });
        }
        const user = await User.findById(id);
        if (!user) {
        return res.status(404).json({ error: 'User not found' });
        }
        await user.deleteOne();
        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Server error' });
    }
    };

    const getUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: 'Invalid user ID' });
        }
        const user = await User.findById(id).select('-password').populate('roles').populate('permissions');
        if (!user) {
        return res.status(404).json({ error: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Server error' });
    }
    };

    const getMe = async (req, res) => {
    try {
        const userId = req.user?._id?.toString();
        if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: 'Invalid user ID' });
        }

        const user = await User.findById(userId)
        .select('-password')
        .populate({
            path: 'roles',
            populate: { path: 'permissions', select: 'name status' },
        })
        .populate({ path: 'permissions', select: 'name status' });
        if (!user) {
        return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json(user);
    } catch (error) {
        console.error('Error fetching current user:', error);
        res.status(500).json({ error: 'Server error' });
    }
    };

    const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, sortBy = 'firstName', sortOrder = 'asc', search = '' } = req.query;

        // Build query for search
        const query = search
        ? {
            $or: [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ],
            }
        : {};

        // Build sort object
        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

        // Calculate pagination
        const skip = (Number(page) - 1) * Number(limit);
        const limitNumber = Number(limit);

        // Fetch users and total count
        const [users, total] = await Promise.all([
        User.find(query)
            .select('-password')
            .populate('roles')
            .populate('permissions')
            .sort(sort)
            .skip(skip)
            .limit(limitNumber),
        User.countDocuments(query),
        ]);

        // Log for debugging
        console.log('Received query params:', req.query);
        console.log('Returning users:', { data: users, total });

        res.status(200).json({ data: users, total });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
    };

    const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
        }
        const user = await User.findOne({ email }).populate('roles');
        if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
        }
        const token = jwt.sign(
        { userId: user._id, roles: user.roles.map((role) => role.name) },
        process.env.JWT_SECRET || 'your_jwt_secret',
        { expiresIn: '1h' }
        );
        res.status(200).json({ token, user: { id: user._id, email: user.email, roles: user.roles } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
    };

    const activateUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: 'Invalid user ID' });
        }
        const user = await User.findById(id);
        if (!user) {
        return res.status(404).json({ error: 'User not found' });
        }
        user.status = 'active';
        await user.save();
        res.status(200).json({ message: 'User activated successfully' });
    } catch (error) {
        console.error('Error activating user:', error);
        res.status(500).json({ error: 'Server error' });
    }
    };

    const deactivateUser = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: 'Invalid user ID' });
        }
        const user = await User.findById(id);
        if (!user) {
        return res.status(404).json({ error: 'User not found' });
        }
        user.status = 'inactive';
        await user.save();
        res.status(200).json({ message: 'User deactivated successfully' });
    } catch (error) {
        console.error('Error deactivating user:', error);
        res.status(500).json({ error: 'Server error' });
    }
    };

    const grantRoleToUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { roleId } = req.body;
        if (!id.match(/^[0-9a-fA-F]{24}$/) || !roleId?.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: 'Invalid user ID or role ID' });
        }

        const [user, role] = await Promise.all([
        User.findById(id),
        Role.findById(roleId),
        ]);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (!role) return res.status(404).json({ error: 'Role not found' });

        await User.findByIdAndUpdate(id, { $set: { roles: [roleId] } });
        return res.status(200).json({ message: 'Role granted successfully' });
    } catch (error) {
        console.error('Error granting role:', error);
        return res.status(500).json({ error: 'Server error' });
    }
    };

    const revokeRoleFromUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { roleId } = req.body;
        if (!id.match(/^[0-9a-fA-F]{24}$/) || !roleId?.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: 'Invalid user ID or role ID' });
        }

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        await User.findByIdAndUpdate(id, { $set: { roles: [] } });
        return res.status(200).json({ message: 'Role revoked successfully' });
    } catch (error) {
        console.error('Error revoking role:', error);
        return res.status(500).json({ error: 'Server error' });
    }
    };

    const grantPermissionToUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { permissionId } = req.body;
        if (!id.match(/^[0-9a-fA-F]{24}$/) || !permissionId?.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: 'Invalid user ID or permission ID' });
        }

        const [user, permission] = await Promise.all([
        User.findById(id),
        Permission.findOne({ _id: permissionId, status: 'active' }),
        ]);
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (!permission) return res.status(404).json({ error: 'Permission not found' });

        await User.findByIdAndUpdate(id, { $addToSet: { permissions: permissionId } });
        return res.status(200).json({ message: 'Permission granted successfully' });
    } catch (error) {
        console.error('Error granting permission:', error);
        return res.status(500).json({ error: 'Server error' });
    }
    };

    const revokePermissionFromUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { permissionId } = req.body;
        if (!id.match(/^[0-9a-fA-F]{24}$/) || !permissionId?.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({ error: 'Invalid user ID or permission ID' });
        }

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        await User.findByIdAndUpdate(id, { $pull: { permissions: permissionId } });
        return res.status(200).json({ message: 'Permission revoked successfully' });
    } catch (error) {
        console.error('Error revoking permission:', error);
        return res.status(500).json({ error: 'Server error' });
    }
    };

    module.exports = {
    createUser,
    updateUser,
    deleteUser,
    getUser,
    getMe,
    getAllUsers,
    login,
    activateUser,
    deactivateUser,
    grantRoleToUser,
    revokeRoleFromUser,
    grantPermissionToUser,
    revokePermissionFromUser,
    };
