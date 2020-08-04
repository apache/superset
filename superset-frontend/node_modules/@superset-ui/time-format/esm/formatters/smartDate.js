"use strict";

exports.__esModule = true;
exports.default = void 0;

var _createMultiFormatter = _interopRequireDefault(require("../factories/createMultiFormatter"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const smartDateFormatter = (0, _createMultiFormatter.default)({
  id: 'smart_date',
  label: 'Adaptative Formatting',
  formats: {
    millisecond: '.%Lms',
    second: ':%Ss',
    minute: '%I:%M',
    hour: '%I %p',
    day: '%a %d',
    week: '%b %d',
    month: '%B',
    year: '%Y'
  }
});
var _default = smartDateFormatter;
exports.default = _default;