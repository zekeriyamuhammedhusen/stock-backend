const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

router.use(auth);

router.get('/', checkPermission('view_product'), productController.getProducts);
router.get('/:id', checkPermission('view_product'), productController.getProductById);
router.post('/', checkPermission('create_product'), productController.createProduct);
router.put('/:id', checkPermission('update_product'), productController.updateProduct);
router.delete('/:id', checkPermission('delete_product'), productController.deleteProduct);
router.post('/:id/activate', checkPermission('activate_product'), productController.activateProduct);
router.post('/:id/deactivate', checkPermission('deactivate_product'), productController.deactivateProduct);

module.exports = router;
