/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

const { getConfig } = require('@airbnb/config-babel');

const config = getConfig({
  library: true,
  react: true,
  next: true,
  esm: process.env.BABEL_OUTPUT === 'esm',
  node: process.env.NODE_ENV === 'test',
  typescript: true,
  env: {
    targets: false,
  },
});

// Override to allow transpile es modules inside vega-lite
config.ignore = config.ignore.filter(item => item !== 'node_modules/');
config.ignore.push('node_modules/(?!(vega-lite|lodash-es))');
config.plugins = [
  ['babel-plugin-transform-dev', { evaluate: false }],
  ['babel-plugin-typescript-to-proptypes', { loose: true }],
  ['@babel/plugin-proposal-class-properties', { loose: true }],
];
config.presets.push([
  '@emotion/babel-preset-css-prop',
  {
    autoLabel: 'dev-only',
    labelFormat: '[local]',
  },
]);
module.exports = config;
