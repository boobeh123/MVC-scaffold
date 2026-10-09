# mvc-scaffold

One command to start a new Express app that already follows my code standards: MVC folders, middleware in the right order, helmet with Content-Security-Policy, sessions in MongoDB, Passport login, validation, rate limiting, and a generic error handler.

```bash
node ~/projects/mvc-scaffold/bin/mvcScaffold.js my-app
cd my-app
npm run dev
```

Add `--no-install` to create the files without running `npm install`.

## What you get

```
my-app/
├── server.js            dotenv → trust proxy → helmet → morgan → body parsers → static →
│                        sessions (connect-mongo) → passport → flash → routes → 404 → error handler
├── config/              database.js (sanitizeFilter on), passport.js (local strategy)
├── middleware/          auth.js, validators.js, rateLimiters.js
├── routes/              indexRoutes.js, authRoutes.js
├── controller/          indexController.js, authController.js
├── model/               User.js (bcrypt cost 12)
├── views/               index, login, signup, dashboard, error + partials/
├── public/              css/normalize.css (v8.0.1), css/styles.css, js/main.js
├── .env                 local DB_STRING + random SESSION_SECRET (owner-only permissions)
├── .env.example
└── .gitignore
```

Working out of the box: sign up, log in, log out, a protected `/dashboard`, flash messages, and a rate limit of 20 auth attempts per 15 minutes.

## How it was tested

Generated an app, ran it against a real MongoDB 8.2, and checked with curl: validation errors, signup → auto login, protected route redirect, logout, duplicate email, wrong password and unknown email giving the same message, email trimmed and lowercased, NoSQL-injection JSON body rejected, bcrypt `$2b$12$` hashes stored, rate limiter returning 429 on attempt 21, 404 page, no session cookie or database row for anonymous visitors.

## Notes

- Dependencies install at the major versions the template was tested with (see `DEPENDENCIES` in `bin/mvcScaffold.js`). Bump them there after testing a new major.
- connect-flash (last released 2013) prints a `util.isArray` deprecation warning on Node 24. It works, but a future Node release could break it.
- The flash middleware in `server.js` only reads `req.flash()` when the session already has messages. Reading it otherwise writes an empty object to the session, which gives every anonymous visitor a session cookie and a MongoDB document.
- No Cloudinary or Multer yet; add them per project when it needs uploads.
