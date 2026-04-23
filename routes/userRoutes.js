const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

router.use(authMiddleware);

router.get('/me', userController.getMe);
router.post('/', roleMiddleware(['Admin']), userController.createUser);
router.put('/:id', roleMiddleware(['Admin']), userController.updateUser);
router.delete('/:id', roleMiddleware(['Admin']), userController.deleteUser); // Line 11
router.post('/:id/activate', roleMiddleware(['Admin']), userController.activateUser);
router.post('/:id/deactivate', roleMiddleware(['Admin']), userController.deactivateUser);
router.post('/:id/roles/grant', roleMiddleware(['Admin']), userController.grantRoleToUser);
router.post('/:id/roles/revoke', roleMiddleware(['Admin']), userController.revokeRoleFromUser);
router.post('/:id/permissions/grant', roleMiddleware(['Admin']), userController.grantPermissionToUser);
router.post('/:id/permissions/revoke', roleMiddleware(['Admin']), userController.revokePermissionFromUser);
router.get('/:id', roleMiddleware(['Admin']), userController.getUser);
router.get('/', roleMiddleware(['Admin']), userController.getAllUsers);

module.exports = router;