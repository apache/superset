'use strict'

var evalAllowed = false;
try {
  eval('evalAllowed = true');
} catch (e) {
  // eval not allowed due to CSP
}

// RHL needs setPrototypeOf to operate Component inheritance, and eval to patch methods
var platformSupported = !!Object.setPrototypeOf && evalAllowed;

if (!module.hot || process.env.NODE_ENV === 'production' || !platformSupported) {
  if (module.hot) {
    // we are not in prod mode, but RHL could not be activated
    console.warn('React-Hot-Loaded is not supported in this environment');
  }
  module.exports = require('./dist/react-hot-loader.production.min.js');
} else {
  module.exports = require('./dist/react-hot-loader.development.js');
}
