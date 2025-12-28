#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

// Change to the backend directory to ensure ormconfig.js is found
process.chdir(path.join(__dirname, '..', 'packages', 'backend'));

// Run TypeORM CLI with proper paths
const typeormPath = path.join(__dirname, '..', 'node_modules', 'typeorm', 'cli.js');
const args = process.argv.slice(2);

const child = spawn('node', [typeormPath, ...args], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..', 'packages', 'backend'),
  env: {
    ...process.env,
    NODE_OPTIONS: '--no-warnings --experimental-vm-modules'
  }
});

child.on('exit', (code) => {
  process.exit(code);
});
