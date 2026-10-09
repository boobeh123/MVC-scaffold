const express = require('express');
const indexController = require('../controller/indexController');
const { ensureAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', indexController.getIndex);
router.get('/dashboard', ensureAuth, indexController.getDashboard);

module.exports = router;
