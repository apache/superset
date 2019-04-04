'use strict';

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactTestRenderer = require('react-test-renderer');

var _reactTestRenderer2 = _interopRequireDefault(_reactTestRenderer);

var _color = require('../../helpers/color');

var _Material = require('./Material');

var _Material2 = _interopRequireDefault(_Material);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* global test, test, expect */

test('Material renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_Material2.default, _color.red)).toJSON();
  expect(tree).toMatchSnapshot();
});