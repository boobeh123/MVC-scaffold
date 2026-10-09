const passport = require('passport');
const { validationResult, matchedData } = require('express-validator');
const User = require('../model/User');

// MongoDB's error code for a duplicate value in a unique field
const DUPLICATE_KEY = 11000;

// passport's login/logout use callbacks; wrap them so controllers can await them
const logIn = (req, user) =>
  new Promise((resolve, reject) => req.login(user, (err) => (err ? reject(err) : resolve())));

const logOut = (req) =>
  new Promise((resolve, reject) => req.logout((err) => (err ? reject(err) : resolve())));

exports.getLogin = async (req, res) => {
  res.render('login', { title: 'Log in' });
};

exports.postLogin = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('errors', errors.array());
    return res.redirect('/login');
  }

  // passport reads email and password from req.body, which the validators have already checked and trimmed
  passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/login',
    failureFlash: true,
  })(req, res, next);
};

exports.getSignup = async (req, res) => {
  res.render('signup', { title: 'Sign up' });
};

exports.postSignup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('errors', errors.array());
    return res.redirect('/signup');
  }

  const { email, password } = matchedData(req);

  let user;
  try {
    user = await User.create({ email, password });
  } catch (err) {
    // The unique index on email also catches two signups racing each other
    if (err.code !== DUPLICATE_KEY) throw err;
    req.flash('errors', [{ msg: 'An account with that email already exists.' }]);
    return res.redirect('/signup');
  }

  await logIn(req, user);
  req.flash('success', 'Welcome! Your account is ready.');
  res.redirect('/dashboard');
};

exports.postLogout = async (req, res) => {
  await logOut(req);
  req.flash('success', 'You are logged out.');
  res.redirect('/');
};
