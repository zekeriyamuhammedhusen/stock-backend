    const jwt = require('jsonwebtoken');
    const User = require('../models/User');
    const Role = require('../models/Role');

    module.exports = async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        console.log('Auth middleware: No token for', req.originalUrl);
        return res.status(401).json({ error: 'Access denied, no token provided' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
        console.log('Auth middleware: Decoded token:', decoded);

        // Fetch user from DB
        const user = await User.findById(decoded.userId)
        .populate({
            path: 'roles',
            populate: { path: 'permissions' } // populate permissions inside roles
        })
        .populate('permissions');

        if (!user) {
        return res.status(401).json({ error: 'User not found' });
        }

        // Check if user is active
        if (user.status === 'inactive') {
        return res.status(403).json({ error: 'User account is deactivated' });
        }

        req.user = user; // full user document with roles & permissions
        next();
    } catch (error) {
        console.error('Auth middleware: Invalid token:', error.message);
        res.status(401).json({ error: 'Invalid token' });
    }
    };
