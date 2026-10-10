const express = require('express');
const authController = require('../controller/authController');
const { ensureAuth, ensureGuest } = require('../middleware/auth');
const { validateSignup, validateLogin } = require('../middleware/validators');
const { loginLimiter, authLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.get('/login', ensureGuest, authController.getLogin);
router.post('/login', loginLimiter, ensureGuest, validateLogin, authController.postLogin);
router.get('/signup', ensureGuest, authController.getSignup);
router.post('/signup', authLimiter, ensureGuest, validateSignup, authController.postSignup);
router.post('/logout', ensureAuth, authController.postLogout);

module.exports = router;
