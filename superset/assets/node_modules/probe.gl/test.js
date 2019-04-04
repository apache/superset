// This file enables: import 'probe.gl/test'.
// Note: Must be published using package.json "files" field
console.warn("import 'probe.gl/test' is deprecated, use import 'probe.gl/test-utils'"); // eslint-disable-line
module.exports = require('./dist/test-utils');
