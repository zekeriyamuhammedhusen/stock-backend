const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

router.use(auth);

router.get('/', checkPermission('view_category'), categoryController.getCategories);
router.post('/', checkPermission('create_category'), categoryController.createCategory);
router.put('/:id', checkPermission('update_category'), categoryController.updateCategory);
router.delete('/:id', checkPermission('delete_category'), categoryController.deleteCategory);
router.post('/:id/activate', checkPermission('activate_category'), categoryController.activateCategory);
router.post('/:id/deactivate', checkPermission('deactivate_category'), categoryController.deactivateCategory);

module.exports = router;
