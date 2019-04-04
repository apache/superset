'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /* global test, jest, expect */

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactTestRenderer = require('react-test-renderer');

var _reactTestRenderer2 = _interopRequireDefault(_reactTestRenderer);

var _enzyme = require('enzyme');

var _color = require('../../helpers/color');

var _color2 = _interopRequireDefault(_color);

var _Github = require('./Github');

var _Github2 = _interopRequireDefault(_Github);

var _GithubSwatch = require('./GithubSwatch');

var _GithubSwatch2 = _interopRequireDefault(_GithubSwatch);

var _common = require('../common');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

test('Github renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_Github2.default, _color.red)).toJSON();
  expect(tree).toMatchSnapshot();
});

test('Github onChange events correctly', function () {
  var changeSpy = jest.fn(function (data) {
    expect(_color2.default.simpleCheckForValidColor(data)).toBeTruthy();
  });
  var tree = (0, _enzyme.mount)(_react2.default.createElement(_Github2.default, { onChange: changeSpy }));
  expect(changeSpy).toHaveBeenCalledTimes(0);
  var swatches = tree.find(_common.Swatch);
  swatches.at(0).childAt(0).simulate('click');

  expect(changeSpy).toHaveBeenCalled();
});

test('Github with onSwatchHover events correctly', function () {
  var hoverSpy = jest.fn(function (data) {
    expect(_color2.default.simpleCheckForValidColor(data)).toBeTruthy();
  });
  var tree = (0, _enzyme.mount)(_react2.default.createElement(_Github2.default, { onSwatchHover: hoverSpy }));
  expect(hoverSpy).toHaveBeenCalledTimes(0);
  var swatches = tree.find(_common.Swatch);
  swatches.at(0).childAt(0).simulate('mouseOver');

  expect(hoverSpy).toHaveBeenCalled();
});

test('Github `triangle="hide"`', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_Github2.default, _extends({}, _color.red, { triangle: 'hide' }))).toJSON();
  expect(tree).toMatchSnapshot();
});

test('Github `triangle="top-right"`', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_Github2.default, _extends({}, _color.red, { triangle: 'top-right' }))).toJSON();
  expect(tree).toMatchSnapshot();
});

test('GithubSwatch renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_GithubSwatch2.default, { color: '#333' })).toJSON();
  expect(tree).toMatchSnapshot();
});