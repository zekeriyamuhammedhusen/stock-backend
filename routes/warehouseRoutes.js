const express = require('express');
const router = express.Router();
const warehouseController = require('../controllers/warehouseController');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

router.use(auth);

router.get('/', checkPermission('view_warehouse'), warehouseController.getWarehouses);
router.post('/', checkPermission('create_warehouse'), warehouseController.createWarehouse);
router.put('/:id', checkPermission('update_warehouse'), warehouseController.updateWarehouse);
router.delete('/:id', checkPermission('delete_warehouse'), warehouseController.deleteWarehouse);
router.post('/:id/activate', checkPermission('activate_warehouse'), warehouseController.activateWarehouse);
router.post('/:id/deactivate', checkPermission('deactivate_warehouse'), warehouseController.deactivateWarehouse);

module.exports = router;
