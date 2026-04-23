    const User = require('../models/User');

    module.exports = (roles) => async (req, res, next) => {
    try {
        console.log('Token payload:', req.user); // Debug log

        // Process token roles with type checking
        let userRoles = [];
        if (Array.isArray(req.user?.roles)) {
        userRoles = req.user.roles
            .map(role => {
            if (typeof role === 'string') {
                return role.toLowerCase();
            } else if (role && typeof role.name === 'string') {
                return role.name.toLowerCase();
            }
            console.warn('Invalid token role:', role);
            return null;
            })
            .filter(Boolean);
        }
        console.log('Token user roles:', userRoles); // Debug log

        // Fetch user from database for verification
        let user;
        if (req.user?.userId) {
        user = await User.findById(req.user.userId).populate('roles');
        } else if (req.user?.email) {
        user = await User.findOne({ email: req.user.email }).populate('roles');
        }
        console.log('Authenticated User:', user); // Debug log

        // Process database roles
        if (!user) {
        console.warn('User not found in database, using token roles');
        } else if (Array.isArray(user.roles)) {
        userRoles = user.roles
            .map(role => {
            if (typeof role === 'string') {
                return role.toLowerCase();
            } else if (role && typeof role.name === 'string') {
                return role.name.toLowerCase();
            }
            console.warn('Invalid database role:', role);
            return null;
            })
            .filter(Boolean);
        }
        console.log('Database user roles:', userRoles); // Debug log

        // Check if user has any of the allowed roles
        if (!roles.some(role => userRoles.includes(role.toLowerCase()))) {
        return res.status(403).json({ error: 'Access denied' });
        }

        // Update req.user with resolved data
        req.user.userId = user ? user._id.toString() : req.user?.userId;
        req.user.roles = userRoles;
        next();
    } catch (error) {
        console.error('Role middleware error:', error.stack);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
    };