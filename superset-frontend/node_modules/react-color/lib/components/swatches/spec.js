'use strict';

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactTestRenderer = require('react-test-renderer');

var _reactTestRenderer2 = _interopRequireDefault(_reactTestRenderer);

var _enzyme = require('enzyme');

var _color = require('../../helpers/color');

var _color2 = _interopRequireDefault(_color);

var _Swatches = require('./Swatches');

var _Swatches2 = _interopRequireDefault(_Swatches);

var _SwatchesColor = require('./SwatchesColor');

var _SwatchesColor2 = _interopRequireDefault(_SwatchesColor);

var _SwatchesGroup = require('./SwatchesGroup');

var _SwatchesGroup2 = _interopRequireDefault(_SwatchesGroup);

var _common = require('../common');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* global test, jest, expect */

test('Swatches renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_Swatches2.default, { hex: _color.red.hex, colors: [['#fff'], ['#333']] })).toJSON();
  expect(tree).toMatchSnapshot();
});

test('Swatches onChange events correctly', function () {
  var changeSpy = jest.fn(function (data) {
    expect(_color2.default.simpleCheckForValidColor(data)).toBeTruthy();
  });
  var tree = (0, _enzyme.mount)(_react2.default.createElement(_Swatches2.default, { onChange: changeSpy }));
  expect(changeSpy).toHaveBeenCalledTimes(0);
  var swatches = tree.find(_common.Swatch);
  swatches.at(0).childAt(0).simulate('click');

  expect(changeSpy).toHaveBeenCalled();
});

test('Swatches with onSwatchHover events correctly', function () {
  var hoverSpy = jest.fn(function (data) {
    expect(_color2.default.simpleCheckForValidColor(data)).toBeTruthy();
  });
  var tree = (0, _enzyme.mount)(_react2.default.createElement(_Swatches2.default, { onSwatchHover: hoverSpy }));
  expect(hoverSpy).toHaveBeenCalledTimes(0);
  var swatches = tree.find(_common.Swatch);
  swatches.at(0).childAt(0).simulate('mouseOver');

  expect(hoverSpy).toHaveBeenCalled();
});

test('SwatchesColor renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_SwatchesColor2.default, null)).toJSON();
  expect(tree).toMatchSnapshot();
});

test('SwatchesColor renders with props', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_SwatchesColor2.default, { active: true, first: true, last: true })).toJSON();
  expect(tree).toMatchSnapshot();
});

test('SwatchesGroup renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_SwatchesGroup2.default, { active: _color.red.hex, group: ['#fff'] })).toJSON();
  expect(tree).toMatchSnapshot();
});