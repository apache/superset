'use strict';
const browserslist = require('browserslist');
const { compare, has } = require('./helpers');
const external = require('./external');

const aliases = new Map([
  ['and_chr', 'chrome'],
  ['and_ff', 'firefox'],
  ['ie_mob', 'ie'],
  ['ios_saf', 'ios'],
  ['op_mob', 'opera_mobile'],
]);

const validTargets = new Set([
  'android',
  'chrome',
  'edge',
  'electron',
  'firefox',
  'ie',
  'ios',
  'node',
  'opera',
  'opera_mobile',
  'phantom',
  'safari',
  'samsung',
]);

module.exports = function (targets) {
  if (typeof targets !== 'object' || Array.isArray(targets)) {
    targets = { browsers: targets };
  }

  const { browsers, esmodules, node, ...rest } = targets;
  const list = Object.entries(rest);

  if (browsers) {
    list.push(...browserslist(browsers).map(it => it.split(' ')));
  }
  if (esmodules) {
    list.push(...Object.entries(external.modules));
  }
  if (node) {
    list.push(['node', node === 'current' ? process.versions.node : node]);
  }

  const normalized = list.map(([engine, version]) => {
    if (has(browserslist.aliases, engine)) {
      engine = browserslist.aliases[engine];
    }
    if (aliases.has(engine)) {
      engine = aliases.get(engine);
    } else if (engine === 'android' && compare(version, '>', '4.4.4')) {
      engine = 'chrome';
    }
    return [engine, String(version)];
  }).filter(([engine]) => {
    return validTargets.has(engine);
  }).sort(([a], [b]) => {
    return a < b ? -1 : a > b ? 1 : 0;
  });

  const reducedByMinVersion = new Map();
  for (const [engine, version] of normalized) {
    if (!reducedByMinVersion.has(engine) || compare(version, '<=', reducedByMinVersion.get(engine))) {
      reducedByMinVersion.set(engine, version);
    }
  }

  return reducedByMinVersion;
};
