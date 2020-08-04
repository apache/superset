'use strict';

const semver = require('semver');
const flags = require('./flags.json');
const getDescriptors = require('object.getownpropertydescriptors');

const replaceUnderscoresRegex = /_/g;
const leadingDashesRegex = /^--?/;
const trailingValuesRegex = /=.*$/;

const replace = Function.call.bind(String.prototype.replace);
const has = Function.call.bind(Set.prototype.has);
const test = Function.call.bind(RegExp.prototype.test);

const [allowedNodeEnvironmentFlags, detectedSemverRange] = Object.keys(
  flags
).reduce(
  (acc, range) =>
    acc ||
    (semver.satisfies(process.version, range) ? [flags[range], range] : acc),
  null
);

const trimLeadingDashes = flag => replace(flag, leadingDashesRegex, '');

class NodeEnvironmentFlagsSet extends Set {
  constructor(...args) {
    super(...args);

    this.add = () => this;
  }

  delete() {
    return false;
  }

  clear() {}

  has(key) {
    if (typeof key === 'string') {
      key = replace(key, replaceUnderscoresRegex, '-');
      if (test(leadingDashesRegex, key)) {
        key = replace(key, trailingValuesRegex, '');
        return has(this, key);
      }
      return has(nodeFlags, key);
    }
    return false;
  }
}
const nodeFlags = Object.defineProperties(
  new Set(allowedNodeEnvironmentFlags.map(trimLeadingDashes)),
  getDescriptors(Set.prototype)
);

Object.freeze(NodeEnvironmentFlagsSet.prototype.constructor);
Object.freeze(NodeEnvironmentFlagsSet.prototype);

exports.allowedNodeEnvironmentFlags = Object.freeze(
  new NodeEnvironmentFlagsSet(allowedNodeEnvironmentFlags)
);
exports.detectedSemverRange = detectedSemverRange;
