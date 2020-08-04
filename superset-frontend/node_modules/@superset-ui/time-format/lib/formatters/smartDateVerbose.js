"use strict";

exports.__esModule = true;
exports.default = void 0;

var _createMultiFormatter = _interopRequireDefault(require("../factories/createMultiFormatter"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const smartDateFormatter = (0, _createMultiFormatter.default)({
  id: 'smart_date_verbose',
  label: 'Verbose Adaptative Formatting',
  formats: {
    millisecond: '.%L',
    second: '%a %b %d, %I:%M:%S %p',
    minute: '%a %b %d, %I:%M %p',
    hour: '%a %b %d, %I %p',
    day: '%a %b %-e',
    week: '%a %b %-e',
    month: '%b %Y',
    year: '%Y'
  }
});
var _default = smartDateFormatter;
exports.default = _default;