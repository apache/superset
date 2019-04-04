'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /* global test, expect, jest */

// import canvas from 'canvas'

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactTestRenderer = require('react-test-renderer');

var _reactTestRenderer2 = _interopRequireDefault(_reactTestRenderer);

var _enzyme = require('enzyme');

var _color = require('../../helpers/color');

var _color2 = _interopRequireDefault(_color);

var _Alpha = require('./Alpha');

var _Alpha2 = _interopRequireDefault(_Alpha);

var _common = require('../common');

var _AlphaPointer = require('./AlphaPointer');

var _AlphaPointer2 = _interopRequireDefault(_AlphaPointer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

test('Alpha renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_Alpha2.default, _color.red)).toJSON();
  expect(tree).toMatchSnapshot();
});

// test('Alpha renders on server correctly', () => {
//   const tree = renderer.create(
//     <Alpha renderers={{ canvas }} { ...red } />
//   ).toJSON()
//   expect(tree).toMatchSnapshot()
// })

test('Alpha onChange events correctly', function () {
  var changeSpy = jest.fn(function (data) {
    expect(_color2.default.simpleCheckForValidColor(data)).toBeTruthy();
  });
  var tree = (0, _enzyme.mount)(_react2.default.createElement(_Alpha2.default, _extends({}, _color.red, { width: 20, height: 200, onChange: changeSpy })));
  expect(changeSpy).toHaveBeenCalledTimes(0);
  var alphaCommon = tree.find(_common.Alpha);
  alphaCommon.at(0).childAt(2).simulate('mouseDown', {
    pageX: 100,
    pageY: 10
  });
  expect(changeSpy).toHaveBeenCalled();
});

test('Alpha renders vertically', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_Alpha2.default, _extends({}, _color.red, { width: 20, height: 200, direction: 'vertical' }))).toJSON();
  expect(tree).toMatchSnapshot();
});

test('AlphaPointer renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_AlphaPointer2.default, null)).toJSON();
  expect(tree).toMatchSnapshot();
});