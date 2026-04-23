const express = require('express');
const router = express.Router();
const permissionController = require('../controllers/permissionController');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

// Protect all routes with authentication
router.use(authMiddleware);

// Admin-only access
router.get('/', roleMiddleware(['Admin']), permissionController.getPermissions);
router.get('/:id', roleMiddleware(['Admin']), permissionController.getPermission);
router.post('/', roleMiddleware(['Admin']), permissionController.createPermission);
router.put('/:id', roleMiddleware(['Admin']), permissionController.updatePermission);
router.delete('/:id', roleMiddleware(['Admin']), permissionController.deletePermission);
router.post('/:id/activate', roleMiddleware(['Admin']), permissionController.activatePermission);
router.post('/:id/deactivate', roleMiddleware(['Admin']), permissionController.deactivatePermission);

module.exports = router;
