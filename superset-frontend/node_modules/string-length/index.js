'use strict';
const stripAnsi = require('strip-ansi');
const astralRegex = require('astral-regex');

const stringLength = string => stripAnsi(string).replace(astralRegex(), ' ').length;

module.exports = stringLength;
// TODO: Remove this for the next major release
module.exports.default = stringLength;
