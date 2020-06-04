#!/bin/env node
/**
 * Build plugins specified by globs
 */
const { spawnSync } = require('child_process');

const glob = process.argv[2];
const extraArgs = process.argv.slice(2);

process.env.PATH = `./node_modules/.bin:${process.env.PATH}`;

const run = cmd => {
  // eslint-disable-next-line no-console
  console.log(`>> ${cmd}`);
  const [p, ...args] = cmd.split(' ');
  const runner = spawnSync;
  const { status } = runner(p, args, { stdio: 'inherit' });
  if (status !== 0) {
    process.exit(status);
  }
};

const BABEL_CONFIG = '--config-file=../../babel.config.js';

if (glob) {
  // lint is slow, so not turning it on by default
  if (extraArgs.includes('--lint')) {
    run(`nimbus eslint {packages,plugins}/${glob}/{src,test}`);
  }
  run(`nimbus babel --clean --workspaces="@superset-ui/${glob}" ${BABEL_CONFIG}`);
  run(`nimbus babel --clean --workspaces="@superset-ui/${glob}" --esm ${BABEL_CONFIG}`);
  run(`nimbus typescript --build --workspaces="@superset-ui/${glob}"`);
  // eslint-disable-next-line global-require
  require('./copyAssets');
} else {
  run('yarn babel');
  run('yarn type');
  run('yarn build:assets');
}
