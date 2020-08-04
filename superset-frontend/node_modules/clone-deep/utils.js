'use strict';

/**
 * Lazily required module dependencies
 */

var utils = require('lazy-cache')(require);
var fn = require;

require = utils;
require('is-plain-object', 'isObject');
require('shallow-clone', 'clone');
require('kind-of', 'typeOf');
require('for-own');
require = fn;

/**
 * Expose `utils`
 */

module.exports = utils;
