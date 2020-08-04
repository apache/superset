'use strict';

module.exports = () => {
  if (typeof process.allowedNodeEnvironmentFlags === 'object') {
    return process.allowedNodeEnvironmentFlags;
  }
  return require('./implementation').allowedNodeEnvironmentFlags;
};
