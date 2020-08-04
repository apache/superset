"use strict";

exports.__esModule = true;
exports.default = transformProps;

var _lodash = require("lodash");

function transformProps(chartProps) {
  const {
    width,
    height,
    formData,
    queryData
  } = chartProps;
  const {
    colorScheme,
    maxBubbleSize,
    showLegend,
    xAxisFormat,
    xAxisLabel,
    // TODO: These fields are not supported yet
    // xAxisShowminmax,
    // xLogScale,
    yAxisLabel,
    yAxisFormat // TODO: These fields are not supported yet
    // yAxisShowminmax,
    // yLogScale,

  } = formData;
  const x = formData.x;
  const y = formData.y;
  const series = formData.series;
  const size = formData.size;
  const entity = formData.entity;
  const data = queryData.data;
  return {
    data: (0, _lodash.flatMap)(data.map(row => row.values.map(v => ({
      [x]: v[x],
      [y]: v[y],
      [series]: v[series],
      [size]: v[size],
      [entity]: v[entity]
    })))),
    width,
    height,
    encoding: {
      x: {
        field: x,
        type: 'quantitive',
        format: xAxisFormat,
        scale: {
          type: 'linear'
        },
        axis: {
          orient: 'bottom',
          title: xAxisLabel
        }
      },
      y: {
        field: y,
        type: 'quantitative',
        format: yAxisFormat,
        scale: {
          type: 'linear'
        },
        axis: {
          orient: 'left',
          title: yAxisLabel
        }
      },
      size: {
        field: size,
        type: 'quantitative',
        scale: {
          type: 'linear',
          range: [0, maxBubbleSize]
        }
      },
      fill: {
        field: series,
        type: 'nominal',
        scale: {
          scheme: colorScheme
        },
        legend: showLegend
      },
      group: [{
        field: entity
      }]
    }
  };
}