const express = require('express');
const router = express.Router();
const creditController = require('../controllers/creditController');
const auth = require('../middleware/auth');
const checkPermission = require('../middleware/checkPermission');

router.use(auth);

router.get('/', checkPermission('view_credit'), creditController.getCredits);
router.get('/:id', checkPermission('view_credit'), creditController.getCredit);
router.post('/', checkPermission('create_credit'), creditController.createCredit);
router.put('/:id', checkPermission('update_credit'), creditController.updateCredit);
router.delete('/:id', checkPermission('delete_credit'), creditController.deleteCredit);
router.post('/:id/payment', checkPermission('update_credit'), creditController.recordCreditPayment);

module.exports = router;
