'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; /* global test, jest, expect */

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactTestRenderer = require('react-test-renderer');

var _reactTestRenderer2 = _interopRequireDefault(_reactTestRenderer);

var _color = require('../../helpers/color');

var _Photoshop = require('./Photoshop');

var _Photoshop2 = _interopRequireDefault(_Photoshop);

var _PhotoshopButton = require('./PhotoshopButton');

var _PhotoshopButton2 = _interopRequireDefault(_PhotoshopButton);

var _PhotoshopFields = require('./PhotoshopFields');

var _PhotoshopFields2 = _interopRequireDefault(_PhotoshopFields);

var _PhotoshopPointer = require('./PhotoshopPointer');

var _PhotoshopPointer2 = _interopRequireDefault(_PhotoshopPointer);

var _PhotoshopPointerCircle = require('./PhotoshopPointerCircle');

var _PhotoshopPointerCircle2 = _interopRequireDefault(_PhotoshopPointerCircle);

var _PhotoshopPreviews = require('./PhotoshopPreviews');

var _PhotoshopPreviews2 = _interopRequireDefault(_PhotoshopPreviews);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

test('Photoshop renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_Photoshop2.default, _extends({}, _color.red, { onAccept: function onAccept() {}, onCancel: function onCancel() {} }))).toJSON();
  expect(tree).toMatchSnapshot();
});

test('PhotoshopButton renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_PhotoshopButton2.default, { label: 'accept', onClick: function onClick() {} })).toJSON();
  expect(tree).toMatchSnapshot();
});

test('PhotoshopFields renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_PhotoshopFields2.default, _color.red)).toJSON();
  expect(tree).toMatchSnapshot();
});

test('PhotoshopPointer renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_PhotoshopPointer2.default, null)).toJSON();
  expect(tree).toMatchSnapshot();
});

test('PhotoshopPointerCircle renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_PhotoshopPointerCircle2.default, _color.red)).toJSON();
  expect(tree).toMatchSnapshot();
});

test('PhotoshopPreviews renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_PhotoshopPreviews2.default, _extends({}, _color.red, { currencColor: '#aeee00' }))).toJSON();
  expect(tree).toMatchSnapshot();
});