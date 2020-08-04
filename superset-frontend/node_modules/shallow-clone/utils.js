'use strict';

var utils = require('lazy-cache')(require);
var fn = require;
require = utils;
require('is-extendable', 'isObject');
require('mixin-object', 'mixin');
require('kind-of', 'typeOf');
require = fn;
module.exports = utils;
