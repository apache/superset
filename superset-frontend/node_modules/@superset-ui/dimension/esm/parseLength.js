"use strict";

exports.__esModule = true;
exports.default = parseLength;
const HUNDRED_PERCENT = {
  isDynamic: true,
  multiplier: 1
};

function parseLength(input) {
  if (input === 'auto' || input === '100%') {
    return HUNDRED_PERCENT;
  }

  if (typeof input === 'string' && input.length > 0 && input[input.length - 1] === '%') {
    return {
      isDynamic: true,
      multiplier: parseFloat(input) / 100
    };
  }

  const value = typeof input === 'number' ? input : parseFloat(input);
  return {
    isDynamic: false,
    value
  };
}