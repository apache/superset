/**
 * Get a unique name for an argument name to store in defs
 * @param {Object} defs
 * @return {string} A string like 'arg1', 'arg2', ...
 * @private
 */
function getUniqueArgumentName (defs) {
  return 'arg' + Object.keys(defs).length
}

module.exports = getUniqueArgumentName;
