'use strict';

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./cjs/resolve-pathname.min.js');
} else {
  module.exports = require('./cjs/resolve-pathname.js');
}
