'use strict';

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactTestRenderer = require('react-test-renderer');

var _reactTestRenderer2 = _interopRequireDefault(_reactTestRenderer);

var _enzyme = require('enzyme');

var _Block = require('./Block');

var _Block2 = _interopRequireDefault(_Block);

var _BlockSwatches = require('./BlockSwatches');

var _BlockSwatches2 = _interopRequireDefault(_BlockSwatches);

var _common = require('../common');

var _color = require('../../helpers/color');

var _color2 = _interopRequireDefault(_color);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

test('Block renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_Block2.default, null)).toJSON();
  expect(tree).toMatchSnapshot();
}); /* global test, jest, expect */

test('Block onChange events correctly', function () {
  var changeSpy = jest.fn(function (data) {
    expect(_color2.default.simpleCheckForValidColor(data)).toBeTruthy();
  });
  var tree = (0, _enzyme.mount)(_react2.default.createElement(_Block2.default, { onChange: changeSpy }));
  expect(changeSpy).toHaveBeenCalledTimes(0);
  var swatches = tree.find(_common.Swatch);
  swatches.at(0).childAt(0).simulate('click');

  expect(changeSpy).toHaveBeenCalled();
});

test('Block with onSwatchHover events correctly', function () {
  var hoverSpy = jest.fn(function (data) {
    expect(_color2.default.simpleCheckForValidColor(data)).toBeTruthy();
  });
  var tree = (0, _enzyme.mount)(_react2.default.createElement(_Block2.default, { onSwatchHover: hoverSpy }));
  expect(hoverSpy).toHaveBeenCalledTimes(0);
  var swatches = tree.find(_common.Swatch);
  swatches.at(0).childAt(0).simulate('mouseOver');

  expect(hoverSpy).toHaveBeenCalled();
});

test('Block `triangle="hide"`', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_Block2.default, { triangle: 'hide' })).toJSON();
  expect(tree).toMatchSnapshot();
});

test('BlockSwatches renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_BlockSwatches2.default, { colors: ['#fff', '#999', '#000'] })).toJSON();
  expect(tree).toMatchSnapshot();
});