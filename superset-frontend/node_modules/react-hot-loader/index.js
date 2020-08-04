'use strict';

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./dist/react-hot-loader.production.min.js');
} else if (process.env.NODE_ENV === 'test') {
  module.exports = require('./dist/react-hot-loader.production.min.js');
} else if (typeof window === 'undefined') {
  // this is just server environment
  module.exports = require('./dist/react-hot-loader.production.min.js');
} else if (!module.hot) {
  module.exports = require('./dist/react-hot-loader.production.min.js');
  module.exports.AppContainer.warnAboutHMRDisabled = true;
  module.exports.hot.shouldWrapWithAppContainer = true;
} else {
  var evalAllowed = false;
  var evalError = null;
  try {
    eval('evalAllowed = true');
  } catch (e) {
    // eval not allowed due to CSP
    evalError = e && e.message ? e.message : 'unknown reason';
  }

  // TODO: dont use eval to update methods. see #1273
  // RHL needs setPrototypeOf to operate Component inheritance, and eval to patch methods
  var jsFeaturesPresent = !!Object.setPrototypeOf;

  if (!jsFeaturesPresent || !evalAllowed) {
    // we are not in prod mode, but RHL could not be activated
    console.warn(
      'React-Hot-Loader is not supported in this environment:',
      [
        !jsFeaturesPresent && "some JS features are missing",
        !evalAllowed && "`eval` is not allowed(" + evalError + ")"
      ].join(','),
      '.'
    );
    module.exports = require('./dist/react-hot-loader.production.min.js');
  } else {
    module.exports = window.reactHotLoaderGlobal = require('./dist/react-hot-loader.development.js');
  }
}
