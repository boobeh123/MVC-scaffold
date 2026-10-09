// Only logged-in users get through; everyone else goes to the login page
exports.ensureAuth = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  req.flash('info', 'Log in to see that page.');
  res.redirect('/login');
};

// Logged-in users skip the login and signup pages
exports.ensureGuest = (req, res, next) => {
  if (!req.isAuthenticated()) return next();
  res.redirect('/dashboard');
};
