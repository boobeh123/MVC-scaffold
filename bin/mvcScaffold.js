#!/usr/bin/env node
// Scaffold a new Express 5 + MongoDB + EJS + Passport app that follows Bobby's code standards.
//
//   node bin/mvcScaffold.js my-app              create ./my-app and install packages
//   node bin/mvcScaffold.js my-app --no-install  create files only

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const TEMPLATE_DIR = path.join(__dirname, '..', 'templates');

// Major versions this template was tested with, so a future breaking release doesn't sneak in
const DEPENDENCIES = [
  'bcrypt@6',
  'connect-flash@0.1',
  'connect-mongo@6',
  'dotenv@18',
  'ejs@7',
  'express@5',
  'express-rate-limit@8',
  'express-session@1',
  'express-validator@7',
  'helmet@8',
  'mongoose@9',
  'morgan@1',
  'passport@0.7',
  'passport-local@1',
];

// Template files that can't keep their real name inside this repo
const RENAMES = {
  gitignore: '.gitignore',
  'env.example': '.env.example',
};

const TEXT_EXTENSIONS = ['.js', '.ejs', '.css', '.md', '.json', ''];

/**************************************************************
Helpers
***************************************************************/

const fail = (message) => {
  console.error(`\n  ${message}\n`);
  process.exit(1);
};

// "my-cool-app" -> "My Cool App"
const toTitle = (appName) =>
  appName
    .split('-')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');

// Every file under a folder, as paths relative to it
const listFiles = (dir, base = dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(fullPath, base) : [path.relative(base, fullPath)];
  });

const run = (command, args, cwd) => execFileSync(command, args, { cwd, stdio: 'inherit' });

/**************************************************************
Steps
***************************************************************/

const copyTemplates = (targetDir, replacements) => {
  listFiles(TEMPLATE_DIR).forEach((relativePath) => {
    const fileName = path.basename(relativePath);
    const outputName = RENAMES[fileName] || fileName;
    const outputPath = path.join(targetDir, path.dirname(relativePath), outputName);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    const sourcePath = path.join(TEMPLATE_DIR, relativePath);
    if (!TEXT_EXTENSIONS.includes(path.extname(fileName))) {
      fs.copyFileSync(sourcePath, outputPath);
      return;
    }

    const content = Object.entries(replacements).reduce(
      (text, [placeholder, value]) => text.replaceAll(placeholder, value),
      fs.readFileSync(sourcePath, 'utf8')
    );
    fs.writeFileSync(outputPath, content);
  });
};

const writePackageJson = (targetDir, appName) => {
  const packageJson = {
    name: appName,
    version: '1.0.0',
    private: true,
    description: '',
    main: 'server.js',
    type: 'commonjs',
    scripts: {
      start: 'node server.js',
      dev: 'node --watch server.js',
    },
    // Pin the Node major version the app was created with, so hosts like Railway build with
    // the Node you develop on instead of their own default (which can be years old)
    engines: {
      node: `${process.versions.node.split('.')[0]}.x`,
    },
  };
  fs.writeFileSync(path.join(targetDir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
};

// A real .env for local development, with a long random session secret
const writeEnv = (targetDir, appName) => {
  const env = [
    'PORT=3000',
    'NODE_ENV=development',
    `DB_STRING=mongodb://127.0.0.1:27017/${appName}`,
    `SESSION_SECRET=${crypto.randomBytes(48).toString('hex')}`,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(targetDir, '.env'), env, { mode: 0o600 });
};

/**************************************************************
Main
***************************************************************/

const main = () => {
  const args = process.argv.slice(2);
  const appName = args.find((arg) => !arg.startsWith('--'));
  const shouldInstall = !args.includes('--no-install');

  if (!appName) fail('Usage: mvcScaffold <app-name> [--no-install]');

  // Lowercase letters, numbers, and dashes, starting with a letter: safe as a folder,
  // an npm package name, a database name, and inside HTML
  if (!/^[a-z][a-z0-9-]*$/.test(appName)) {
    fail('Use lowercase letters, numbers, and dashes for the app name, starting with a letter (e.g. my-app).');
  }

  const targetDir = path.resolve(process.cwd(), appName);
  if (fs.existsSync(targetDir)) fail(`${targetDir} already exists. Pick another name or remove it first.`);

  console.log(`\nCreating ${appName} in ${targetDir}`);
  fs.mkdirSync(targetDir);
  copyTemplates(targetDir, { '{{appName}}': appName, '{{appTitle}}': toTitle(appName) });
  writePackageJson(targetDir, appName);
  writeEnv(targetDir, appName);

  if (shouldInstall) {
    console.log('\nInstalling packages...');
    run('npm', ['install', ...DEPENDENCIES], targetDir);
    console.log('\nRunning npm audit...');
    try {
      run('npm', ['audit'], targetDir);
    } catch {
      console.log('\n  npm audit found issues. Fix critical and high ones before deploying.');
    }
  }

  try {
    execFileSync('git', ['init', '-q'], { cwd: targetDir });
  } catch {
    console.log('  (git not found, skipped git init)');
  }

  console.log(`
Done! Next:
  cd ${appName}
  ${shouldInstall ? '' : 'npm install\n  '}npm run dev

.env has a local DB_STRING and a random SESSION_SECRET.
Swap DB_STRING for your Atlas connection string if you're not running MongoDB locally.
`);
};

main();
