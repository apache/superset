'use strict';

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./cjs/history.min.js');
} else {
  module.exports = require('./cjs/history.js');
}
