const express = require('express');
const router = express.Router();
const approvalController = require('../controllers/approvalController');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

router.use(authMiddleware);
router.use(roleMiddleware(['Admin']));

router.get('/', approvalController.getApprovalRequests);
router.post('/:id/approve', approvalController.approveRequest);
router.post('/:id/reject', approvalController.rejectRequest);

module.exports = router;
