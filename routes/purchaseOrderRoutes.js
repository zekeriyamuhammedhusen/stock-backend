const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

router.use(auth);

router.get('/', checkPermission('view_purchase_order'), purchaseOrderController.getPurchaseOrders);
router.get('/:id', checkPermission('view_purchase_order'), purchaseOrderController.getPurchaseOrderById);
router.post('/', checkPermission('create_purchase_order'), purchaseOrderController.createPurchaseOrder);
router.patch(
  '/:id/status',
  checkPermission('update_purchase_order_status'),
  purchaseOrderController.updatePurchaseOrderStatus
);

module.exports = router;
