const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

router.use(auth);

router.get('/inventory', checkPermission('view_inventory'), stockController.getInventory);
router.get('/transactions', checkPermission('view_stock_transactions'), stockController.getStockTransactions);
router.post('/in', checkPermission('create_stock_in'), stockController.stockIn);
router.post('/out', checkPermission('create_stock_out'), stockController.stockOut);

module.exports = router;
