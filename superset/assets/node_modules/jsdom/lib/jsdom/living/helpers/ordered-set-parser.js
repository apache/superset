"use strict";

module.exports = function orderedSetParser(input) {
  return new Set(input.split(/[\t\n\f\r ]+/).filter(Boolean));
};
