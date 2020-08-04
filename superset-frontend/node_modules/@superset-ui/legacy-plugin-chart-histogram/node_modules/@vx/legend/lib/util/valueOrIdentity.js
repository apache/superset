"use strict";

exports.__esModule = true;
exports.default = valueOrIdentity;
exports.valueOrIdentityString = valueOrIdentityString;

/** Returns an object's value if defined, or the object. */
function valueOrIdentity(_) {
  if (_ && typeof _ === 'object' && 'value' in _ && typeof _.value !== 'undefined') return _.value;
  return _;
}
/** Returns an object's value if defined, or the object, coerced to a string. */


function valueOrIdentityString(_) {
  return String(valueOrIdentity(_));
}