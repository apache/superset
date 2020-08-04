"use strict";

exports.__esModule = true;
exports.scatterPlotEncoderFactory = void 0;

var _encodable = require("encodable");

const scatterPlotEncoderFactory = (0, _encodable.createEncoderFactory)({
  channelTypes: {
    x: 'X',
    y: 'Y',
    fill: 'Color',
    group: 'Category',
    size: 'Numeric',
    stroke: 'Color',
    tooltip: 'Text'
  },
  defaultEncoding: {
    x: {
      field: 'x',
      type: 'quantitative'
    },
    y: {
      field: 'y',
      type: 'quantitative'
    },
    fill: {
      value: '#222'
    },
    group: [],
    size: {
      value: 5
    },
    stroke: {
      value: 'none'
    },
    tooltip: []
  }
});
exports.scatterPlotEncoderFactory = scatterPlotEncoderFactory;