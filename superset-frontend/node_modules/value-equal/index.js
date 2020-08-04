'use strict';

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./cjs/value-equal.min.js');
} else {
  module.exports = require('./cjs/value-equal.js');
}
