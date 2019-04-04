// This file is intended for use in the GL-JS test suite
// It provides the shaders entry point for Node (tests and GL Native)
// In a browser environment, this file is replaced with ./src/shaders/shaders.js
// when Rollup builds the main bundle.
// See https://github.com/mapbox/mapbox-gl-js/blob/master/package.json#L104-L108

/* eslint-disable import/unambiguous, import/no-commonjs, flowtype/require-valid-file-annotation, no-global-assign */

const fs = require('fs');

// enable ES Modules in Node
require = require("esm")(module);

// enable requiring GLSL in Node
require.extensions['.glsl'] = function (module, filename) {
    const content = fs.readFileSync(filename, 'utf8');
    module._compile(`module.exports = \`${content}\``, filename);
};

module.exports = require("./shaders.js");
