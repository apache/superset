'use strict';

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _react3 = require('@storybook/react');

var _report = require('../../../.storybook/report');

var _SyncColorField = require('../../../.storybook/SyncColorField');

var _SyncColorField2 = _interopRequireDefault(_SyncColorField);

var _Twitter = require('./Twitter');

var _Twitter2 = _interopRequireDefault(_Twitter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(0, _react3.storiesOf)('Pickers', module).add('TwitterPicker', function () {
  return _react2.default.createElement(
    _SyncColorField2.default,
    { component: _Twitter2.default },
    (0, _report.renderWithKnobs)(_Twitter2.default, {}, null, {
      width: { range: true, min: 140, max: 500, step: 1 }
    })
  );
});