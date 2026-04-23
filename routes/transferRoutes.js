const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

router.use(auth);

router.get('/', checkPermission('view_transfer'), transferController.getTransfers);
router.get('/source-warehouses', checkPermission('view_transfer'), transferController.getAvailableSourceWarehouses);
router.post('/', checkPermission('create_transfer'), transferController.createTransfer);
router.patch('/:id/status', checkPermission('update_transfer_status'), transferController.updateTransferStatus);

module.exports = router;
