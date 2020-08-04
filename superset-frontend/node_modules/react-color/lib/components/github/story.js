'use strict';

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _react3 = require('@storybook/react');

var _report = require('../../../.storybook/report');

var _SyncColorField = require('../../../.storybook/SyncColorField');

var _SyncColorField2 = _interopRequireDefault(_SyncColorField);

var _Github = require('./Github');

var _Github2 = _interopRequireDefault(_Github);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

(0, _react3.storiesOf)('Pickers', module).add('GithubPicker', function () {
  return _react2.default.createElement(
    _SyncColorField2.default,
    { component: _Github2.default },
    (0, _report.renderWithKnobs)(_Github2.default, {}, null, {
      width: { range: true, min: 140, max: 500, step: 1 }
    })
  );
});