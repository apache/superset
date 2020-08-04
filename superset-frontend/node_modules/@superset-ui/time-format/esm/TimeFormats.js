"use strict";

exports.__esModule = true;
exports.default = exports.LOCAL_PREFIX = void 0;
const LOCAL_PREFIX = 'local!';
exports.LOCAL_PREFIX = LOCAL_PREFIX;
const DATABASE_DATETIME = '%Y-%m-%d %H:%M:%S';
const DATABASE_DATETIME_REVERSE = '%d-%m-%Y %H:%M:%S';
const US_DATE = '%m/%d/%Y';
const INTERNATIONAL_DATE = '%d/%m/%Y';
const DATABASE_DATE = '%Y-%m-%d';
const TIME = '%H:%M:%S';
const TimeFormats = {
  DATABASE_DATE,
  DATABASE_DATETIME,
  DATABASE_DATETIME_REVERSE,
  INTERNATIONAL_DATE,
  TIME,
  US_DATE
};
var _default = TimeFormats;
exports.default = _default;