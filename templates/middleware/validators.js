const { body } = require('express-validator');

// .isString().bail() first: an object or array (like {"$ne": null}) stops there with one clear message
exports.validateSignup = [
  body('email')
    .isString()
    .withMessage('Enter a valid email address.')
    .bail()
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Enter a valid email address.')
    .isLength({ max: 254 })
    .withMessage('That email address is too long.'),
  // bcrypt only uses the first 72 bytes of a password, so cap it there
  body('password')
    .isString()
    .withMessage('Enter a password.')
    .bail()
    .isLength({ min: 8, max: 72 })
    .withMessage('Use 8 to 72 characters for your password.'),
  body('confirmPassword')
    .isString()
    .withMessage('Confirm your password.')
    .bail()
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords do not match.'),
];

exports.validateLogin = [
  body('email')
    .isString()
    .withMessage('Enter a valid email address.')
    .bail()
    .trim()
    .toLowerCase()
    .isEmail()
    .withMessage('Enter a valid email address.'),
  body('password').isString().withMessage('Enter your password.').bail().notEmpty().withMessage('Enter your password.'),
];
