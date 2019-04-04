'use strict';

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactTestRenderer = require('react-test-renderer');

var _reactTestRenderer2 = _interopRequireDefault(_reactTestRenderer);

var _color = require('../../helpers/color');

var _Slider = require('./Slider');

var _Slider2 = _interopRequireDefault(_Slider);

var _SliderPointer = require('./SliderPointer');

var _SliderPointer2 = _interopRequireDefault(_SliderPointer);

var _SliderSwatch = require('./SliderSwatch');

var _SliderSwatch2 = _interopRequireDefault(_SliderSwatch);

var _SliderSwatches = require('./SliderSwatches');

var _SliderSwatches2 = _interopRequireDefault(_SliderSwatches);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

test('Slider renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_Slider2.default, _color.red)).toJSON();
  expect(tree).toMatchSnapshot();
}); /* global test, expect */

test('SliderPointer renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_SliderPointer2.default, null)).toJSON();
  expect(tree).toMatchSnapshot();
});

test('SliderSwatch renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_SliderSwatch2.default, _color.red)).toJSON();
  expect(tree).toMatchSnapshot();
});

test('SliderSwatches renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_SliderSwatches2.default, _color.red)).toJSON();
  expect(tree).toMatchSnapshot();
});