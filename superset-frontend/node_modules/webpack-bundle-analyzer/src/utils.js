const {inspect} = require('util');
const _ = require('lodash');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

exports.createAssetsFilter = createAssetsFilter;

function createAssetsFilter(excludePatterns) {
  const excludeFunctions = _(excludePatterns)
    .castArray()
    .compact()
    .map(pattern => {
      if (typeof pattern === 'string') {
        pattern = new RegExp(pattern, 'u');
      }

      if (_.isRegExp(pattern)) {
        return (asset) => pattern.test(asset);
      }

      if (!_.isFunction(pattern)) {
        throw new TypeError(
          `Pattern should be either string, RegExp or a function, but "${inspect(pattern, {depth: 0})}" got.`
        );
      }

      return pattern;
    })
    .value();

  if (excludeFunctions.length) {
    return (asset) => _.every(excludeFunctions, fn => fn(asset) !== true);
  } else {
    return () => true;
  }
}

/**
 * @desc get string of current time
 * format: dd/MMM HH:mm
 * */
exports.getCurrentTime = function () {
  const time = new Date();
  const year = time.getFullYear();
  const month = MONTHS[time.getMonth()];
  const day = time.getDate();
  const hour = `0${time.getHours()}`.slice(-2);
  const minute = `0${time.getMinutes()}`.slice(-2);
  return `${day} ${month} ${year} at ${hour}:${minute}`;
};
