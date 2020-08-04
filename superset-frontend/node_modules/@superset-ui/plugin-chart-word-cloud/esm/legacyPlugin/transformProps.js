"use strict";

exports.__esModule = true;
exports.default = transformProps;

function getMetricLabel(metric) {
  if (typeof metric === 'string' || typeof metric === 'undefined') {
    return metric;
  }

  if (Array.isArray(metric)) {
    return metric.length > 0 ? getMetricLabel(metric[0]) : undefined;
  }

  return metric.label;
}

function transformProps(chartProps) {
  const {
    width,
    height,
    formData,
    queryData
  } = chartProps;
  const {
    colorScheme,
    metric,
    rotation,
    series,
    sizeFrom = 0,
    sizeTo
  } = formData;
  const metricLabel = getMetricLabel(metric);
  const encoding = {
    color: {
      field: series,
      scale: {
        scheme: colorScheme
      },
      type: 'nominal'
    },
    fontSize: typeof metricLabel === 'undefined' ? undefined : {
      field: metricLabel,
      scale: {
        range: [sizeFrom, sizeTo],
        zero: true
      },
      type: 'quantitative'
    },
    text: {
      field: series
    }
  };
  return {
    data: queryData.data,
    encoding,
    height,
    rotation,
    width
  };
}