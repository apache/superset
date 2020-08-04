"use strict";

exports.__esModule = true;
exports.default = stringifyTimeInput;

function stringifyTimeInput(value, fn) {
  if (value === null || value === undefined) {
    return "" + value;
  }

  return fn(value instanceof Date ? value : new Date(value));
}