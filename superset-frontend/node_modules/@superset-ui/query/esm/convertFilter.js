"use strict";

exports.__esModule = true;
exports.default = convertFilter;

var _Filter = require("./types/Filter");

function convertFilter(filter) {
  const {
    subject
  } = filter;

  if ((0, _Filter.isUnaryAdhocFilter)(filter)) {
    const {
      operator
    } = filter;
    return {
      col: subject,
      op: operator
    };
  }

  if ((0, _Filter.isBinaryAdhocFilter)(filter)) {
    const {
      operator
    } = filter;
    return {
      col: subject,
      op: operator,
      val: filter.comparator
    };
  }

  const {
    operator
  } = filter;
  return {
    col: subject,
    op: operator,
    val: filter.comparator
  };
}