'use strict';

exports.__esModule = true;
exports.requiredRoles = requiredRoles;
exports.exclusiveRoles = exclusiveRoles;

var _createChainableTypeChecker = require('prop-types-extra/lib/utils/createChainableTypeChecker');

var _createChainableTypeChecker2 = _interopRequireDefault(_createChainableTypeChecker);

var _ValidComponentChildren = require('./ValidComponentChildren');

var _ValidComponentChildren2 = _interopRequireDefault(_ValidComponentChildren);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function requiredRoles() {
  for (var _len = arguments.length, roles = Array(_len), _key = 0; _key < _len; _key++) {
    roles[_key] = arguments[_key];
  }

  return (0, _createChainableTypeChecker2.default)(function (props, propName, component) {
    var missing = void 0;

    roles.every(function (role) {
      if (!_ValidComponentChildren2.default.some(props.children, function (child) {
        return child.props.bsRole === role;
      })) {
        missing = role;
        return false;
      }

      return true;
    });

    if (missing) {
      return new Error('(children) ' + component + ' - Missing a required child with bsRole: ' + (missing + '. ' + component + ' must have at least one child of each of ') + ('the following bsRoles: ' + roles.join(', ')));
    }

    return null;
  });
}

function exclusiveRoles() {
  for (var _len2 = arguments.length, roles = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
    roles[_key2] = arguments[_key2];
  }

  return (0, _createChainableTypeChecker2.default)(function (props, propName, component) {
    var duplicate = void 0;

    roles.every(function (role) {
      var childrenWithRole = _ValidComponentChildren2.default.filter(props.children, function (child) {
        return child.props.bsRole === role;
      });

      if (childrenWithRole.length > 1) {
        duplicate = role;
        return false;
      }

      return true;
    });

    if (duplicate) {
      return new Error('(children) ' + component + ' - Duplicate children detected of bsRole: ' + (duplicate + '. Only one child each allowed with the following ') + ('bsRoles: ' + roles.join(', ')));
    }

    return null;
  });
}