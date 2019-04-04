'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /* global test, jest, expect */

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactTestRenderer = require('react-test-renderer');

var _reactTestRenderer2 = _interopRequireDefault(_reactTestRenderer);

var _color = require('../../helpers/color');

var _color2 = _interopRequireDefault(_color);

var _enzyme = require('enzyme');

var _Chrome = require('./Chrome');

var _Chrome2 = _interopRequireDefault(_Chrome);

var _ChromeFields = require('./ChromeFields');

var _ChromeFields2 = _interopRequireDefault(_ChromeFields);

var _ChromePointer = require('./ChromePointer');

var _ChromePointer2 = _interopRequireDefault(_ChromePointer);

var _ChromePointerCircle = require('./ChromePointerCircle');

var _ChromePointerCircle2 = _interopRequireDefault(_ChromePointerCircle);

var _common = require('../common');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

test('Chrome renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_Chrome2.default, _color.red)).toJSON();
  expect(tree).toMatchSnapshot();
});

test('Chrome onChange events correctly', function () {
  var changeSpy = jest.fn(function (data) {
    expect(_color2.default.simpleCheckForValidColor(data)).toBeTruthy();
  });
  var tree = (0, _enzyme.mount)(_react2.default.createElement(_Chrome2.default, _extends({}, _color.red, { onChange: changeSpy })));
  expect(changeSpy).toHaveBeenCalledTimes(0);

  // check the Alpha component
  var alphaCommon = tree.find(_common.Alpha);
  alphaCommon.at(0).childAt(2).simulate('mouseDown', {
    pageX: 100,
    pageY: 10
  });
  expect(changeSpy).toHaveBeenCalledTimes(1);

  // TODO: check the Hue component
  // TODO: check the ChromeFields
  // TODO: check Saturation
});

// test('Chrome renders on server correctly', () => {
//   const tree = renderer.create(
//     <Chrome renderers={{ canvas }} { ...red } />
//   ).toJSON()
//   expect(tree).toMatchSnapshot()
// })

test('ChromeFields renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_ChromeFields2.default, _color.red)).toJSON();
  expect(tree).toMatchSnapshot();
});

test('ChromePointer renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_ChromePointer2.default, null)).toJSON();
  expect(tree).toMatchSnapshot();
});

test('ChromePointerCircle renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_ChromePointerCircle2.default, null)).toJSON();
  expect(tree).toMatchSnapshot();
});