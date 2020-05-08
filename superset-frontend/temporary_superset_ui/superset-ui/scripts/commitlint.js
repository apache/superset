#!/usr/bin/env node
/**
 * Check commit messages only for the first commit in branch.
 */
const { execSync, spawnSync } = require('child_process');

const envVariable = process.argv[2] || 'GIT_PARAMS';

if (!envVariable || !process.env[envVariable]) {
  process.stdout.write(`Please provide a commit message via \`${envVariable}={Your Message}\`.\n`);
  process.exit(0);
}
if (execSync('git rev-list --count HEAD ^master', { encoding: 'utf-8' }).trim() === '0') {
  const { status } = spawnSync(`commitlint`, ['-E', envVariable], { stdio: 'inherit' });
  process.exit(status);
}
