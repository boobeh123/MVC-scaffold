# {{appTitle}}

Express 5 + MongoDB + EJS app with Passport login, scaffolded by mvc-scaffold.

## Getting started

```bash
npm install        # already done if you scaffolded with install on
npm run dev        # restarts on file changes
```

Then open http://localhost:3000.

`.env` was generated with a random `SESSION_SECRET` and a local `DB_STRING`. For MongoDB Atlas, replace `DB_STRING` with your connection string. `.env` is gitignored; `.env.example` lists every key with no values.

## Structure

```
server.js       Middleware in order: dotenv, trust proxy, helmet, morgan, body parsers,
                static, sessions (connect-mongo), passport, flash, routes, 404, error handler
config/         Database connection and Passport local strategy
middleware/     auth.js (ensureAuth, ensureGuest), validators.js, rateLimiters.js
routes/         indexRoutes.js, authRoutes.js
controller/     indexController.js, authController.js
model/          User.js (bcrypt cost 12)
views/          EJS pages + partials/ (head, header, flash, footer)
public/         normalize.css, styles.css, main.js
```

## Deploying on Railway

Set `NODE_ENV=production`, `DB_STRING`, and `SESSION_SECRET` in the service variables. Run `npm audit` before going live.
