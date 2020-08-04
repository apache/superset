'use strict';
const { compare, has, intersection } = require('./helpers');
const data = require('./data');
const getModulesListForTargetVersion = require('./get-modules-list-for-target-version');
const modules = require('./modules');
const targetsParser = require('./targets-parser');

function checkModule(name, targets) {
  if (!has(data, name)) throw new TypeError(`Incorrect module: ${ name }`);

  const requirements = data[name];
  const result = {
    required: false,
    targets: {},
  };

  for (const [engine, version] of targets) {
    if (!has(requirements, engine) || compare(version, '<', requirements[engine])) {
      result.required = true;
      result.targets[engine] = version;
    }
  }

  return result;
}

module.exports = function ({ targets, filter, version }) {
  const parsedTargets = targetsParser(targets);

  const result = {
    list: [],
    targets: {},
  };

  let $modules = Array.isArray(filter) ? filter : modules;

  if (filter instanceof RegExp) {
    $modules = $modules.filter(it => filter.test(it));
  } else if (typeof filter == 'string') {
    $modules = $modules.filter(it => it.startsWith(filter));
  }

  if (version) {
    $modules = intersection($modules, getModulesListForTargetVersion(version));
  }

  for (const key of $modules) {
    const check = checkModule(key, parsedTargets);
    if (check.required) {
      result.list.push(key);
      result.targets[key] = check.targets;
    }
  }

  return result;
};
