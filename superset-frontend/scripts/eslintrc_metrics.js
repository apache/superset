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

const packageConfig = require('../package');

const importCoreModules = [];
Object.entries(packageConfig.dependencies).forEach(([pkg]) => {
  if (/@superset-ui/.test(pkg)) {
    importCoreModules.push(pkg);
  }
});


module.exports = {
  extends: [
    'plugin:react-prefer-function-component/recommended',
  ],
  parser: '@babel/eslint-parser',
  parserOptions: {
    ecmaFeatures: {
      experimentalObjectRestSpread: true,
    },
  },
  env: {
    browser: true,
  },
  settings: {
    'import/resolver': {
      webpack: {},
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      },
    },
    // Allow only core/src and core/test, avoid import modules from lib
    'import/internal-regex': /^@superset-ui\/core\/(src|test)\/.*/,
    'import/core-modules': importCoreModules,
    react: {
      version: 'detect',
    },
  },
  plugins: [
    'react',
    'react-prefer-function-component',
  ],
  rules: {
    'react-prefer-function-component/react-prefer-function-component': 1,
    'react/jsx-filename-extension': [1, { extensions: ['.tsx'] }],
    'react/forbid-component-props': 1,
  },
};
