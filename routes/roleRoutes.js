const express = require('express');
const router = express.Router();
const roleController = require('../controllers/roleController');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

// Protect all routes with authentication
router.use(authMiddleware);

// Role-based access control
router.get('/', roleMiddleware(['Admin']), roleController.getRoles);
router.get('/:id', roleMiddleware(['Admin']), roleController.getRole);
router.post('/', roleMiddleware(['Admin']), roleController.createRole);
router.put('/:id', roleMiddleware(['Admin']), roleController.updateRole);
router.delete('/:id', roleMiddleware(['Admin']), roleController.deleteRole);
router.post('/:id/activate', roleMiddleware(['Admin']), roleController.activateRole);
router.post('/:id/deactivate', roleMiddleware(['Admin']), roleController.deactivateRole);
router.post('/assign', roleMiddleware(['Admin']), roleController.assignRole);
router.post('/remove', roleMiddleware(['Admin']), roleController.removeRole);

module.exports = router;