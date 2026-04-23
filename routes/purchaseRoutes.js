const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

router.use(auth);

router.get('/', checkPermission('view_purchase'), purchaseController.getPurchases);
router.post('/', checkPermission('create_purchase'), purchaseController.createPurchase);

module.exports = router;
