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

## Testing

```bash
npm install   # once, for the test's throwaway MongoDB
npm test
```

`test/smokeTest.js` scaffolds a real app into a temp folder, installs it, starts it against a throwaway MongoDB 8.2 (`mongodb-memory-server`), and checks over HTTP:

- the expected files exist, `.env` has a random 96-character secret and owner-only permissions
- anonymous visitors get no session cookie; security headers are set
- `/dashboard` redirects guests to login with a message
- invalid signup shows each validation message; a valid signup logs you straight in
- logged-in users skip the login page; logout works
- duplicate email is refused; wrong password and unknown email get the same message
- a NoSQL-injection JSON body is rejected with plain messages
- email is trimmed and lowercased; 404 page renders
- the 21st auth attempt gets a 429 "Too many attempts" page

Run it after changing a template or bumping a major version in `DEPENDENCIES`. It takes about 15 seconds once npm's cache is warm. On a Raspberry Pi (Debian on ARM) it automatically uses MongoDB's Ubuntu 24.04 build, since there's no Debian ARM build.

## Notes

- Dependencies install at the major versions the template was tested with (see `DEPENDENCIES` in `bin/mvcScaffold.js`). Bump them there after testing a new major.
- connect-flash (last released 2013) prints a `util.isArray` deprecation warning on Node 24. It works, but a future Node release could break it.
- The flash middleware in `server.js` only reads `req.flash()` when the session already has messages. Reading it otherwise writes an empty object to the session, which gives every anonymous visitor a session cookie and a MongoDB document.
- No Cloudinary or Multer yet; add them per project when it needs uploads.
