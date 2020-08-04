"use strict";

exports.__esModule = true;
exports.boxPlotEncoderFactory = void 0;

var _encodable = require("encodable");

const boxPlotEncoderFactory = (0, _encodable.createEncoderFactory)({
  channelTypes: {
    x: 'XBand',
    y: 'YBand',
    color: 'Color'
  },
  defaultEncoding: {
    x: {
      field: 'x',
      type: 'nominal'
    },
    y: {
      field: 'y',
      type: 'quantitative'
    },
    color: {
      value: '#222'
    }
  }
});
exports.boxPlotEncoderFactory = boxPlotEncoderFactory;