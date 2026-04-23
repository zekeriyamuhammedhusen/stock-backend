const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

router.use(auth);

router.get('/', checkPermission('view_sale'), saleController.getSales);
router.get('/summary', checkPermission('view_sale_summary'), saleController.getSalesSummary);
router.get('/source-warehouses', checkPermission('view_sale'), saleController.getAvailableSourceWarehouses);
router.post('/', checkPermission('create_sale'), saleController.createSale);

module.exports = router;
