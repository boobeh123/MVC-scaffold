// End-to-end smoke test: scaffold a real app, install it, run it against a throwaway MongoDB,
// and walk through signup, login, logout, validation, and rate limiting over HTTP.
//
//   npm test
//
// Takes a minute or two, mostly npm install. Run it after changing templates or bumping DEPENDENCIES.

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const net = require('node:net');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { MongoMemoryServer } = require('mongodb-memory-server');

const CLI = path.join(__dirname, '..', 'bin', 'mvcScaffold.js');
const APP_NAME = 'smoke-app';
const AUTH_LIMIT = 20; // must match middleware/rateLimiters.js in the template

// MongoDB doesn't publish ARM builds for Debian; Raspberry Pi OS runs the Ubuntu 24.04 build fine
const useUbuntuMongoOnDebianArm = () => {
  try {
    const isDebian = fs.readFileSync('/etc/os-release', 'utf8').includes('ID=debian');
    if (process.arch === 'arm64' && isDebian) process.env.MONGOMS_DISTRO ??= 'ubuntu-24.04';
  } catch {
    // Not Linux, nothing to do
  }
};

const getFreePort = () =>
  new Promise((resolve) => {
    const server = net.createServer().listen(0, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('scaffolded app', () => {
  let tempDir;
  let mongo;
  let app;
  let baseUrl;
  let dbConnection; // a direct connection, to check what the app stores
  let cookie = ''; // a one-cookie jar is all the app needs (connect.sid)
  let authAttempts = 0; // POSTs to /login and /signup count toward the rate limit

  // Fetch without following redirects, carrying the session cookie like a browser would
  const request = async (urlPath, { method = 'GET', form, json, useCookie = true } = {}) => {
    const headers = {};
    let body;
    if (form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(form).toString();
    }
    if (json) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(json);
    }
    if (useCookie && cookie) headers.Cookie = cookie;
    if (method === 'POST' && ['/login', '/signup'].includes(urlPath)) authAttempts += 1;

    const response = await fetch(baseUrl + urlPath, { method, headers, body, redirect: 'manual' });
    const setCookie = response.headers.getSetCookie().find((value) => value.startsWith('connect.sid='));
    if (useCookie && setCookie) cookie = setCookie.split(';')[0];
    return { status: response.status, location: response.headers.get('location'), setCookie, html: await response.text() };
  };

  // Flash messages rendered on a page, as "type: text"
  const getFlashes = async (urlPath) => {
    const { html } = await request(urlPath);
    return [...html.matchAll(/class="flash (\w+)">([^<]*)</g)].map(([, type, text]) => `${type}: ${text.trim()}`);
  };

  before(async () => {
    useUbuntuMongoOnDebianArm();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mvc-scaffold-test-'));
    execFileSync(process.execPath, [CLI, APP_NAME], { cwd: tempDir, stdio: 'ignore' });

    mongo = await MongoMemoryServer.create();
    const port = await getFreePort();
    baseUrl = `http://127.0.0.1:${port}`;

    // Real env vars win over the generated .env (dotenv doesn't override them)
    app = spawn(process.execPath, ['server.js'], {
      cwd: path.join(tempDir, APP_NAME),
      env: { ...process.env, PORT: String(port), DB_STRING: mongo.getUri(APP_NAME), NODE_ENV: 'test' },
      stdio: 'ignore',
    });

    // The generated app's own mongoose, so the test needs no extra dependency
    const mongoose = require(path.join(tempDir, APP_NAME, 'node_modules', 'mongoose'));
    dbConnection = await mongoose.createConnection(mongo.getUri(APP_NAME)).asPromise();

    for (let tries = 0; tries < 100; tries += 1) {
      try {
        await fetch(baseUrl);
        return;
      } catch {
        await wait(200);
      }
    }
    throw new Error('App did not start');
  });

  after(async () => {
    await dbConnection?.close();
    app?.kill();
    await mongo?.stop();
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('generates the expected files', () => {
    const appDir = path.join(tempDir, APP_NAME);
    [
      'server.js', 'config/database.js', 'config/passport.js', 'middleware/auth.js', 'middleware/validators.js',
      'middleware/rateLimiters.js', 'routes/indexRoutes.js', 'routes/authRoutes.js', 'controller/indexController.js',
      'controller/authController.js', 'model/User.js', 'views/partials/flash.ejs', 'public/css/normalize.css',
      '.gitignore', '.env.example', '.env', 'package-lock.json',
    ].forEach((file) => assert.ok(fs.existsSync(path.join(appDir, file)), `missing ${file}`));

    const env = fs.readFileSync(path.join(appDir, '.env'), 'utf8');
    assert.match(env, /^SESSION_SECRET=[0-9a-f]{96}$/m);
    assert.equal(fs.statSync(path.join(appDir, '.env')).mode & 0o777, 0o600);

    const packageJson = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
    assert.equal(packageJson.engines.node, `${process.versions.node.split('.')[0]}.x`);
  });

  it('serves the home page without giving anonymous visitors a session', async () => {
    const { status, setCookie, html } = await request('/', { useCookie: false });
    assert.equal(status, 200);
    assert.equal(setCookie, undefined);
    assert.match(html, /Smoke App/);
  });

  it('sends security headers', async () => {
    const response = await fetch(baseUrl);
    assert.ok(response.headers.get('content-security-policy'));
    assert.equal(response.headers.get('x-powered-by'), null);
  });

  it('protects the dashboard', async () => {
    const { status, location } = await request('/dashboard');
    assert.equal(status, 302);
    assert.equal(location, '/login');
    assert.deepEqual(await getFlashes('/login'), ['flashInfo: Log in to see that page.']);
  });

  it('rejects an invalid signup with clear messages, without storing what was typed', async () => {
    const typed = { email: 'not-an-email', password: 'tiny-pw', confirmPassword: 'other-pw' };
    const { location } = await request('/signup', { method: 'POST', form: typed });
    assert.equal(location, '/signup');

    // Flash messages wait in the session, and connect-mongo saves sessions in MongoDB
    const stored = JSON.stringify(await dbConnection.db.collection('sessions').find().toArray());
    const leaked = Object.values(typed).filter((value) => stored.includes(value));
    assert.deepEqual(leaked, [], 'the session store holds what was typed');

    assert.deepEqual(await getFlashes('/signup'), [
      'flashError: Enter a valid email address.',
      'flashError: Use 8 to 72 characters for your password.',
      'flashError: Passwords do not match.',
    ]);
  });

  it('signs up, logs in, and shows the dashboard', async () => {
    const { location } = await request('/signup', {
      method: 'POST',
      form: { email: 'Bobby@Example.com', password: 'correcthorse', confirmPassword: 'correcthorse' },
    });
    assert.equal(location, '/dashboard');
    const { html } = await request('/dashboard');
    assert.match(html, /flashSuccess">Welcome! Your account is ready\./);
    assert.match(html, /<strong>bobby@example\.com<\/strong>/);
  });

  it('keeps logged-in users off the login page', async () => {
    const { location } = await request('/login');
    assert.equal(location, '/dashboard');
  });

  it('logs out', async () => {
    const { location } = await request('/logout', { method: 'POST' });
    assert.equal(location, '/');
    assert.deepEqual(await getFlashes('/'), ['flashSuccess: You are logged out.']);
    assert.equal((await request('/dashboard')).location, '/login');
    await getFlashes('/login'); // clear the "log in to see that page" message
  });

  it('refuses a duplicate email', async () => {
    await request('/signup', {
      method: 'POST',
      form: { email: 'bobby@example.com', password: 'correcthorse', confirmPassword: 'correcthorse' },
    });
    assert.deepEqual(await getFlashes('/signup'), ['flashError: An account with that email already exists.']);
  });

  it('gives the same message for a wrong password and an unknown email', async () => {
    await request('/login', { method: 'POST', form: { email: 'bobby@example.com', password: 'wrongwrong' } });
    const wrongPassword = await getFlashes('/login');
    await request('/login', { method: 'POST', form: { email: 'nobody@example.com', password: 'wrongwrong' } });
    const unknownEmail = await getFlashes('/login');
    assert.deepEqual(wrongPassword, ['flashError: Invalid email or password.']);
    assert.deepEqual(unknownEmail, wrongPassword);
  });

  it('blocks a NoSQL injection attempt with plain validation messages', async () => {
    const { location } = await request('/login', {
      method: 'POST',
      json: { email: { $ne: null }, password: { $ne: null } },
    });
    assert.equal(location, '/login');
    assert.deepEqual(await getFlashes('/login'), [
      'flashError: Enter a valid email address.',
      'flashError: Enter your password.',
    ]);
  });

  it('logs in with a differently formatted email', async () => {
    const { location } = await request('/login', {
      method: 'POST',
      form: { email: '  BOBBY@example.com ', password: 'correcthorse' },
    });
    assert.equal(location, '/dashboard');
    await request('/logout', { method: 'POST' });
    await getFlashes('/');
  });

  it('renders the 404 page', async () => {
    const { status, html } = await request('/no-such-page');
    assert.equal(status, 404);
    assert.match(html, /Page not found/);
  });

  it(`rate limits auth after ${AUTH_LIMIT} attempts`, async () => {
    let firstBlockedAttempt = null;
    while (firstBlockedAttempt === null && authAttempts <= AUTH_LIMIT + 2) {
      const { status, html } = await request('/login', {
        method: 'POST',
        form: { email: 'bobby@example.com', password: 'wrongwrong' },
      });
      if (status === 429) {
        firstBlockedAttempt = authAttempts;
        assert.match(html, /Too many attempts/);
      }
    }
    assert.equal(firstBlockedAttempt, AUTH_LIMIT + 1);
  });
});
