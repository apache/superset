'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = getImplicitRole;

var _implicitRoles = require('./implicitRoles');

var _implicitRoles2 = _interopRequireDefault(_implicitRoles);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Returns an element's implicit role given its attributes and type.
 * Some elements only have an implicit role when certain props are defined.
 *
 * @param type - The node's tagName.
 * @param attributes - The collection of attributes on the node.
 * @returns {String} - String representing the node's implicit role or '' if it doesn't exist.
 */
function getImplicitRole(type, attributes) {
  if (_implicitRoles2.default[type]) {
    return _implicitRoles2.default[type](attributes);
  }

  return '';
}