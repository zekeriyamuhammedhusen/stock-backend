const express = require('express');
const router = express.Router();
const { login, forgotPassword, resetPassword, logout } = require('../controllers/authController');

router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;