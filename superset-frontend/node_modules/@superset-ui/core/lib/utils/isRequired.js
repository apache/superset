"use strict";

exports.__esModule = true;
exports.default = isRequired;

function isRequired(field) {
  throw new Error(field + " is required.");
}