'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /* global test, expect */

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactTestRenderer = require('react-test-renderer');

var _reactTestRenderer2 = _interopRequireDefault(_reactTestRenderer);

var _color = require('../../helpers/color');

var _Hue = require('./Hue');

var _Hue2 = _interopRequireDefault(_Hue);

var _HuePointer = require('./HuePointer');

var _HuePointer2 = _interopRequireDefault(_HuePointer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

test('Hue renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_Hue2.default, _color.red)).toJSON();
  expect(tree).toMatchSnapshot();
});

test('Hue renders vertically', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_Hue2.default, _extends({}, _color.red, { width: 20, height: 200, direction: 'vertical' }))).toJSON();
  expect(tree).toMatchSnapshot();
});

test('HuePointer renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_HuePointer2.default, null)).toJSON();
  expect(tree).toMatchSnapshot();
});