/**
 * Build only plugins specified by globs
 */
const { spawnSync, spawn } = require('child_process');

const glob = process.argv[2];

process.env.PATH = `./node_modules/.bin:${process.env.PATH}`;

const run = (cmd, async = false) => {
  console.log(`>> ${cmd}`);
  const [p, ...args] = cmd.split(' ');
  const runner = async ? spawn : spawnSync;
  runner(p, args, { stdio: 'inherit' });
};

if (glob) {
  run(`nimbus prettier --check --workspaces=\"@superset-ui/${glob}"`);
  run(`nimbus babel --clean --workspaces=\"@superset-ui/${glob}"`);
  run(`nimbus babel --clean --workspaces=\"@superset-ui/${glob}" --esm`);
  run(`nimbus typescript --build --workspaces=\"@superset-ui/${glob}"`);
  require('./buildAssets');
} else {
  run('yarn build');
}
