"use strict";

exports.__esModule = true;
exports.default = void 0;

var _CategoricalScheme = _interopRequireDefault(require("../../CategoricalScheme"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const schemes = [{
  id: 'lyftColors',
  label: 'Lyft Colors',
  colors: ['#EA0B8C', '#6C838E', '#29ABE2', '#33D9C1', '#9DACB9', '#7560AA', '#2D5584', '#831C4A', '#333D47', '#AC2077']
}].map(s => new _CategoricalScheme.default(s));
var _default = schemes;
exports.default = _default;