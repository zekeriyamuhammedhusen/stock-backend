const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unitController');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

router.use(auth);

router.get('/', checkPermission('view_unit'), unitController.getUnits);
router.post('/', checkPermission('create_unit'), unitController.createUnit);
router.put('/:id', checkPermission('update_unit'), unitController.updateUnit);
router.delete('/:id', checkPermission('delete_unit'), unitController.deleteUnit);
router.post('/:id/activate', checkPermission('activate_unit'), unitController.activateUnit);
router.post('/:id/deactivate', checkPermission('deactivate_unit'), unitController.deactivateUnit);

module.exports = router;
