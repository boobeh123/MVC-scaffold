const rateLimit = require('express-rate-limit');

exports.authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // express-rate-limit v7+; older versions call this option max
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).render('error', {
      title: 'Too many attempts',
      message: 'Too many attempts. Wait 15 minutes and try again.',
    });
  },
});
