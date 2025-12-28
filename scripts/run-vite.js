#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Find Vite binary in various possible locations
const possiblePaths = [
  // Direct binary path
  path.join(__dirname, '..', 'node_modules', '.bin', 'vite'),
  
  // Vite module path
  path.join(__dirname, '..', 'node_modules', 'vite', 'bin', 'vite.js'),
  
  // pnpm locations (check .pnpm directory)
  ...(() => {
    const pnpmDir = path.join(__dirname, '..', 'node_modules', '.pnpm');
    if (!fs.existsSync(pnpmDir)) return [];
    
    return fs.readdirSync(pnpmDir)
      .filter(dir => dir.startsWith('vite@'))
      .map(dir => path.join(pnpmDir, dir, 'node_modules', 'vite', 'bin', 'vite.js'));
  })(),
];

let vitePath = null;
for (const testPath of possiblePaths) {
  if (fs.existsSync(testPath)) {
    vitePath = testPath;
    break;
  }
}

if (!vitePath) {
  console.error('Could not find Vite binary in any of the expected locations:');
  possiblePaths.forEach(p => console.error(`  - ${p}`));
  console.error('\nTrying fallback to npx...');
  
  // Fallback to npx
  const child = spawn('npx', ['vite', ...process.argv.slice(2)], {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  child.on('exit', (code) => {
    process.exit(code);
  });
  
  return;
}

// Execute Vite with the provided arguments
const args = process.argv.slice(2);
const child = spawn('node', [vitePath, ...args], {
  stdio: 'inherit',
  cwd: process.cwd()
});

child.on('exit', (code) => {
  process.exit(code);
});
