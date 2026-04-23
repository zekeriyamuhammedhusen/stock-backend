const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

router.use(auth);

router.get('/low-stock', checkPermission('view_low_stock_report'), reportController.getLowStockReport);
router.get('/profit-loss', checkPermission('view_profit_loss_report'), reportController.getProfitLossReport);
router.get('/dashboard-metrics', checkPermission('view_dashboard_metrics'), reportController.getDashboardMetrics);
router.get('/sales', checkPermission('view_sales_report'), reportController.getSalesReport);
router.get('/supplier-performance', checkPermission('view_supplier_performance_report'), reportController.getSupplierPerformanceReport);

module.exports = router;
