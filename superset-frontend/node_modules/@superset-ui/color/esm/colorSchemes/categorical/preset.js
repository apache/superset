"use strict";

exports.__esModule = true;
exports.default = void 0;

var _CategoricalScheme = _interopRequireDefault(require("../../CategoricalScheme"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const schemes = [{
  id: 'presetColors',
  label: 'Preset Colors',
  colors: [// Full color
  '#6BD3B3', '#FCC550', '#408184', '#66CBE2', '#EE5960', '#484E5A', '#FF874E', '#03748E', '#C9BBAB', '#B17BAA', // Pastels
  '#B5E9D9', '#FDE2A7', '#9FC0C1', '#B2E5F0', '#F6ACAF', '#A4A6AC', '#FFC3A6', '#81B9C6', '#E4DDD5', '#D9BDD5']
}].map(s => new _CategoricalScheme.default(s));
var _default = schemes;
exports.default = _default;