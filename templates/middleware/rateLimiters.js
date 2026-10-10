const rateLimit = require('express-rate-limit');

const FIFTEEN_MINUTES = 15 * 60 * 1000;

const showTooManyAttempts = (req, res) => {
  res.status(429).render('error', {
    title: 'Too many attempts',
    message: 'Too many attempts. Wait 15 minutes and try again.',
  });
};

// Counts failed logins only: a login that ends with the user logged in is taken back off the count,
// so people sharing one IP address (a household, an office) don't use up each other's attempts
exports.loginLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 10, // express-rate-limit v7+; older versions call this option max
  skipSuccessfulRequests: true,
  requestWasSuccessful: (req) => req.isAuthenticated(),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: showTooManyAttempts,
});

// Signup and any other account forms: every attempt counts
exports.authLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: showTooManyAttempts,
});
