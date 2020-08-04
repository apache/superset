"use strict";

exports.__esModule = true;
exports.default = transformProps;

function transformProps(chartProps) {
  const {
    width,
    height,
    formData,
    queryData
  } = chartProps;
  const {
    encoding,
    rotation
  } = formData;
  return {
    data: queryData.data,
    encoding,
    height,
    rotation,
    width
  };
}