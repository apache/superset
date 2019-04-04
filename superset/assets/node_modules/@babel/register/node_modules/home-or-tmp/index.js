'use strict';
const os = require('os');

module.exports = os.homedir() || os.tmpdir();
