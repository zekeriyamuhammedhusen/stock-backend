const express = require('express');
const router = express.Router();
const bankAccountController = require('../controllers/bankAccountController');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

router.use(auth);

router.get('/', checkPermission('view_bank_account'), bankAccountController.getBankAccounts);
router.get('/:id', checkPermission('view_bank_account'), bankAccountController.getBankAccount);
router.post('/', checkPermission('create_bank_account'), bankAccountController.createBankAccount);
router.put('/:id', checkPermission('update_bank_account'), bankAccountController.updateBankAccount);
router.delete('/:id', checkPermission('delete_bank_account'), bankAccountController.deleteBankAccount);
router.post('/:id/activate', checkPermission('activate_bank_account'), bankAccountController.activateBankAccount);
router.post('/:id/deactivate', checkPermission('deactivate_bank_account'), bankAccountController.deactivateBankAccount);

module.exports = router;
