/* global setTimeout, clearTimeout */
/* eslint-disable consistent-this, func-names */
export default function debounce(func, delay) {
  let _this;
  let _arguments;
  let timeout;

  const executeNow = () => {
    timeout = null;
    return func.apply(_this, _arguments);
  };

  return function() {
    _this = this;
    _arguments = arguments;

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(executeNow, delay);
  };
}
