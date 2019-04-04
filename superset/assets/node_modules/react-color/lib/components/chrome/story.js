'use strict';

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _react3 = require('@storybook/react');

var _report = require('../../../.storybook/report');

var _SyncColorField = require('../../../.storybook/SyncColorField');

var _SyncColorField2 = _interopRequireDefault(_SyncColorField);

var _Chrome = require('./Chrome');

var _Chrome2 = _interopRequireDefault(_Chrome);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(0, _react3.storiesOf)('Pickers', module).add('ChromePicker', function () {
  return _react2.default.createElement(
    _SyncColorField2.default,
    { component: _Chrome2.default },
    (0, _report.renderWithKnobs)(_Chrome2.default, {}, null)
  );
});