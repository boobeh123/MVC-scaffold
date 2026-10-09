require('dotenv').config(); // First: load .env before anything reads process.env

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const passport = require('passport');
const flash = require('connect-flash');
const connectDB = require('./config/database');

require('./config/passport')(passport);

// Connect once; the session store reuses this connection
const clientPromise = connectDB();

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// 1. Trust Railway's proxy: required for req.ip, rate limiting, and secure cookies
app.set('trust proxy', 1);
app.set('view engine', 'ejs');

// 2. Security headers: must come before everything else
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'], // Allow Cloudinary images
        upgradeInsecureRequests: isProduction ? [] : null, // Local dev runs on plain HTTP
      },
    },
  })
);

// 3. Logging
app.use(morgan(isProduction ? 'combined' : 'dev'));

// 4. Body parsing
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// 5. Static files: before sessions, so asset requests don't touch the session store
app.use(express.static('public'));

// 6. Sessions, stored in MongoDB
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ clientPromise }),
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
    },
  })
);

// 7. Passport: after sessions
app.use(passport.initialize());
app.use(passport.session());

// 8. Flash messages: mount connect-flash, then expose messages and the logged-in user to every view
app.use(flash());
app.use((req, res, next) => {
  // Calling req.flash() writes an empty flash object into the session, which would give every
  // anonymous visitor a session cookie and a database row. Only read it when there's something there.
  const readFlash = (type) => (req.session.flash ? req.flash(type) : []);
  res.locals.success = readFlash('success');
  res.locals.errors = readFlash('errors');
  res.locals.error = readFlash('error');
  res.locals.info = readFlash('info');
  res.locals.user = req.user || null;
  next();
});

// 9. Routes
app.use('/', require('./routes/indexRoutes'));
app.use('/', require('./routes/authRoutes'));

// 10. 404: after all routes
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page not found',
    message: "We couldn't find that page.",
  });
});

// 11. Centralized error handler: must be last
app.use((err, req, res, next) => {
  console.error(err); // Full details go to the logs, never to the user
  if (res.headersSent) return next(err);

  const status = err.status >= 400 && err.status < 600 ? err.status : 500;
  res.status(status).render('error', {
    title: 'Something went wrong',
    message: 'Something went wrong. Please try again.',
  });
});

clientPromise
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Database connection failed:', err);
    process.exit(1);
  });
