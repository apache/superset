"use strict";

exports.__esModule = true;
exports.default = createTime;

function createTime(mode, year, month = 0, date = 1, hours = 0, minutes = 0, seconds = 0, milliseconds = 0) {
  const args = [year, month, date, hours, minutes, seconds, milliseconds];
  return mode === 'local' ? new Date(...args) : new Date(Date.UTC(...args));
}