const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const User = require('../model/User');

module.exports = (passport) => {
  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      try {
        const user = await User.findOne({ email });

        // Same message for an unknown email and a wrong password,
        // so nobody can use the login form to check which emails have accounts
        if (!user) return done(null, false, { message: 'Invalid email or password.' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return done(null, false, { message: 'Invalid email or password.' });

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  // Store only the user's id in the session, and look the user up on each request
  passport.serializeUser((user, done) => done(null, user.id));

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
};
