'use strict';

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactTestRenderer = require('react-test-renderer');

var _reactTestRenderer2 = _interopRequireDefault(_reactTestRenderer);

var _enzyme = require('enzyme');

var _color = require('../../helpers/color');

var _color2 = _interopRequireDefault(_color);

var _Sketch = require('./Sketch');

var _Sketch2 = _interopRequireDefault(_Sketch);

var _SketchFields = require('./SketchFields');

var _SketchFields2 = _interopRequireDefault(_SketchFields);

var _SketchPresetColors = require('./SketchPresetColors');

var _SketchPresetColors2 = _interopRequireDefault(_SketchPresetColors);

var _common = require('../common');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// import canvas from 'canvas'

/* global test, jest, expect */

test('Sketch renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_Sketch2.default, _color.red)).toJSON();
  expect(tree).toMatchSnapshot();
});

// test('Sketch renders on server correctly', () => {
//   const tree = renderer.create(
//     <Sketch renderers={{ canvas }} { ...red } />
//   ).toJSON()
//   expect(tree).toMatchSnapshot()
// })

test('Sketch onChange events correctly', function () {
  var changeSpy = jest.fn(function (data) {
    expect(_color2.default.simpleCheckForValidColor(data)).toBeTruthy();
  });
  var tree = (0, _enzyme.mount)(_react2.default.createElement(_Sketch2.default, { onChange: changeSpy }));
  expect(changeSpy).toHaveBeenCalledTimes(0);
  var swatches = tree.find(_common.Swatch);
  swatches.at(0).childAt(0).simulate('click');

  expect(changeSpy).toHaveBeenCalled();
});

test('Sketch with onSwatchHover events correctly', function () {
  var hoverSpy = jest.fn(function (data) {
    expect(_color2.default.simpleCheckForValidColor(data)).toBeTruthy();
  });
  var tree = (0, _enzyme.mount)(_react2.default.createElement(_Sketch2.default, { onSwatchHover: hoverSpy }));
  expect(hoverSpy).toHaveBeenCalledTimes(0);
  var swatches = tree.find(_common.Swatch);
  swatches.at(0).childAt(0).simulate('mouseOver');

  expect(hoverSpy).toHaveBeenCalled();
});

test('SketchFields renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_SketchFields2.default, _color.red)).toJSON();
  expect(tree).toMatchSnapshot();
});

test('SketchPresetColors renders correctly', function () {
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_SketchPresetColors2.default, { colors: ['#fff', '#999', '#000'] })).toJSON();
  expect(tree).toMatchSnapshot();
});

test('SketchPresetColors with custom titles renders correctly', function () {
  var colors = [{
    color: '#fff',
    title: 'white'
  }, {
    color: '#999',
    title: 'gray'
  }, {
    color: '#000'
  }, '#f00'];
  var tree = _reactTestRenderer2.default.create(_react2.default.createElement(_SketchPresetColors2.default, { colors: colors })).toJSON();
  expect(tree).toMatchSnapshot();
});