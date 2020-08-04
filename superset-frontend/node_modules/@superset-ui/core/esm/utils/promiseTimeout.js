"use strict";

exports.__esModule = true;
exports.default = promiseTimeout;

/** setTimeout that returns a promise */
function promiseTimeout(
/** A function to be executed after the timer expires. */
func,
/** The time, in milliseconds (thousandths of a second), the timer should wait before the specified function or code is executed. If this parameter is omitted, a value of 0 is used, meaning execute "immediately", or more accurately, as soon as possible.  */
delay) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(func());
    }, delay);
  });
}