'use strict';

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactTestRenderer = require('react-test-renderer');

var _reactTestRenderer2 = _interopRequireDefault(_reactTestRenderer);

var _color = require('../../helpers/color');

var _Alpha = require('./Alpha');

var _Alpha2 = _interopRequireDefault(_Alpha);

var _Checkboard = require('./Checkboard');

var _Checkboard2 = _interopRequireDefault(_Checkboard);

var _EditableInput = require('./EditableInput');

var _EditableInput2 = _interopRequireDefault(_EditableInput);

var _Hue = require('./Hue');

var _Hue2 = _interopRequireDefault(_Hue);

var _Saturation = require('./Saturation');

var _Saturation2 = _interopRequireDefault(_Saturation);

var _Swatch = require('./Swatch');

var _Swatch2 = _interopRequireDefault(_Swatch);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// import canvas from 'canvas'

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

/* global test, jest, expect */

test('Checkboard renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_Checkboard2.default, null)).toJSON();
  expect(tree).toMatchSnapshot();
});

// test('Checkboard renders on server correctly', () => {
//   const tree = renderer.create(
//     <Checkboard renderers={{ canvas }} />
//   ).toJSON()
//   expect(tree).toMatchSnapshot()
// })

test('EditableInput renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_EditableInput2.default, { label: 'Hex', placeholder: '#fff' })).toJSON();
  expect(tree).toMatchSnapshot();
});

test('Hue renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_Hue2.default, _color.red)).toJSON();
  expect(tree).toMatchSnapshot();
});

test('Saturation renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_Saturation2.default, _color.red)).toJSON();
  expect(tree).toMatchSnapshot();
});

test('Swatch renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_Swatch2.default, { color: '#333', style: { opacity: '0.4' } })).toJSON();
  expect(tree).toMatchSnapshot();
});

test('Swatch renders custom title correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_Swatch2.default, { color: '#fff', title: 'white' })).toJSON();
  expect(tree).toMatchSnapshot();
});

test('Swatch renders with an onMouseOver handler correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_Swatch2.default, { color: '#fff', title: 'white', onHover: function onHover() {} })).toJSON();
  expect(tree).toMatchSnapshot();
});