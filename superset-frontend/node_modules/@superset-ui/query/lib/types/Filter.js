"use strict";

exports.__esModule = true;
exports.isSimpleAdhocFilter = isSimpleAdhocFilter;
exports.isUnaryAdhocFilter = isUnaryAdhocFilter;
exports.isBinaryAdhocFilter = isBinaryAdhocFilter;
exports.isSetAdhocFilter = isSetAdhocFilter;

var _Operator = require("./Operator");

//---------------------------------------------------
// Type guards
//---------------------------------------------------
function isSimpleAdhocFilter(filter) {
  return filter.expressionType === 'SIMPLE';
}

function isUnaryAdhocFilter(filter) {
  return (0, _Operator.isUnaryOperator)(filter.operator);
}

function isBinaryAdhocFilter(filter) {
  return (0, _Operator.isBinaryOperator)(filter.operator);
}

function isSetAdhocFilter(filter) {
  return (0, _Operator.isSetOperator)(filter.operator);
}