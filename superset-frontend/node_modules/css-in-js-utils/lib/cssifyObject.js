'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = cssifyObject;

var _cssifyDeclaration = require('./cssifyDeclaration');

var _cssifyDeclaration2 = _interopRequireDefault(_cssifyDeclaration);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function cssifyObject(style) {
  var css = '';

  for (var property in style) {
    var value = style[property];
    if (typeof value !== 'string' && typeof value !== 'number') {
      continue;
    }

    // prevents the semicolon after
    // the last rule declaration
    if (css) {
      css += ';';
    }

    css += (0, _cssifyDeclaration2.default)(property, value);
  }

  return css;
}
module.exports = exports['default'];