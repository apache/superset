'use strict'

const webpack = require('webpack');
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');

module.exports = require('./webpack.config.js');

module.exports.mode = 'production';
module.exports.optimization = {
    minimizer: [
        new UglifyJsPlugin(),
    ]
};

module.exports.output.filename = 'gl-matrix-min.js';
