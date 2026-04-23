    const checkPermission = (permissionName) => {
    return async (req, res, next) => {
        try {
        const user = req.user; // from auth middleware
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const userRoles = Array.isArray(user.roles) ? user.roles : [];
        if (userRoles.some((role) => role?.name === 'Admin')) {
            return next();
        }

        // For non-admin users, enforce direct user permissions only.
        const hasPermission = (user.permissions || []).some(
            (p) => p?.name === permissionName && p?.status === 'active'
        );

        if (!hasPermission) {
            return res.status(403).json({ error: 'Forbidden: Missing permission' });
        }

        next();
        } catch (err) {
        console.error('CheckPermission error:', err.message);
        res.status(500).json({ error: 'Server error' });
        }
    };
    };

    module.exports = checkPermission;
