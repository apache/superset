"use strict";

exports.__esModule = true;
exports.default = roundDecimal;

function roundDecimal(number, precision) {
  let roundedNumber;
  let p = precision;

  if (precision) {
    roundedNumber = Math.round(number * (p = 10 ** p)) / p;
  } else {
    roundedNumber = Math.round(number);
  }

  return roundedNumber;
}