/**
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
// Superset's webpack.config.js
const customConfig = require('../webpack.config.js');

module.exports = {
  core: {
    builder: 'webpack5',
  },
  stories: [
    '../src/@(components|common|filters|explore)/**/*.stories.@(t|j)sx',
  ],
  addons: [
    '@storybook/addon-essentials',
    '@storybook/addon-links',
    'storybook-addon-jsx',
    '@storybook/addon-knobs',
    'storybook-addon-paddings',
  ],
  webpackFinal: config => ({
    ...config,
    module: {
      ...config.module,
      rules: customConfig.module.rules,
    },
    resolve: {
      ...config.resolve,
      ...customConfig.resolve,
    },
    plugins: [...config.plugins, ...customConfig.plugins],
  }),
  typescript: {
    reactDocgen: 'none',
  },
};
