import {
  randomKDE,
  randomLogNormal,
  randomMixture,
  randomNormal,
  randomUniform
} from 'vega-statistics';

import {error, hasOwnProperty} from 'vega-util';

var Distributions = {
  kde:       randomKDE,
  mixture:   randomMixture,
  normal:    randomNormal,
  lognormal: randomLogNormal,
  uniform:   randomUniform
};

var DISTRIBUTIONS = 'distributions',
    FUNCTION = 'function',
    FIELD = 'field';

/**
 * Parse a parameter object for a probability distribution.
 * @param {object} def - The distribution parameter object.
 * @param {function():Array<object>} - A method for requesting
 *   source data. Used for distributions (such as KDE) that
 *   require sample data points. This method will only be
 *   invoked if the 'from' parameter for a target data source
 *   is not provided. Typically this method returns backing
 *   source data for a Pulse object.
 * @return {object} - The output distribution object.
 */
export default function parse(def, data) {
  var func = def[FUNCTION];
  if (!hasOwnProperty(Distributions, func)) {
    error('Unknown distribution function: ' + func);
  }

  var d = Distributions[func]();

  for (var name in def) {
    // if data field, extract values
    if (name === FIELD) {
      d.data((def.from || data()).map(def[name]));
    }

    // if distribution mixture, recurse to parse each definition
    else if (name === DISTRIBUTIONS) {
      d[name](def[name].map(function(_) { return parse(_, data); }));
    }

    // otherwise, simply set the parameter
    else if (typeof d[name] === FUNCTION) {
      d[name](def[name]);
    }
  }

  return d;
}
