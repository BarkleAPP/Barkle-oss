#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Find SWC binary in various possible locations
const possiblePaths = [
  // Direct binary path
  path.join(__dirname, '..', 'node_modules', '.bin', 'swc'),
  
  // SWC module path
  path.join(__dirname, '..', 'node_modules', '@swc', 'cli', 'bin', 'swc.js'),
  
  // pnpm locations (check .pnpm directory)
  ...(() => {
    const pnpmDir = path.join(__dirname, '..', 'node_modules', '.pnpm');
    if (!fs.existsSync(pnpmDir)) return [];
    
    return fs.readdirSync(pnpmDir)
      .filter(dir => dir.startsWith('@swc+cli@'))
      .map(dir => path.join(pnpmDir, dir, 'node_modules', '@swc', 'cli', 'bin', 'swc.js'));
  })(),
];

let swcPath = null;
for (const testPath of possiblePaths) {
  if (fs.existsSync(testPath)) {
    swcPath = testPath;
    break;
  }
}

if (!swcPath) {
  console.error('Could not find SWC binary in any of the expected locations:');
  possiblePaths.forEach(p => console.error(`  - ${p}`));
  console.error('\nTrying fallback to npx...');
  
  // Fallback to npx
  const child = spawn('npx', ['swc', ...process.argv.slice(2)], {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  child.on('exit', (code) => {
    process.exit(code);
  });
  
  return;
}

// Execute SWC with the provided arguments
const args = process.argv.slice(2);
const child = spawn('node', [swcPath, ...args], {
  stdio: 'inherit',
  cwd: process.cwd()
});

child.on('exit', (code) => {
  process.exit(code);
});
