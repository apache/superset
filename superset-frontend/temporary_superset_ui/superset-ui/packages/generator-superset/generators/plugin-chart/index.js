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

/* eslint-disable sort-keys */

const Generator = require('yeoman-generator');
const _ = require('lodash');

module.exports = class extends Generator {
  async prompting() {
    this.option('skipInstall');

    this.answers = await this.prompt([
      {
        type: 'input',
        name: 'packageName',
        message: 'Package name:',
        // Default to current folder name
        default: _.kebabCase(this.appname.replace('plugin chart', '').trim()),
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description:',
        // Default to current folder name
        default: _.upperFirst(
          _.startCase(this.appname.replace('plugin chart', '').trim()),
        ),
      },
      {
        type: 'list',
        name: 'componentType',
        message: 'What type of React component would you like?',
        choices: [
          {
            name: 'Class component',
            value: 'class',
          },
          {
            name: 'Function component (with hooks)',
            value: 'function',
          },
        ],
      },
      {
        type: 'list',
        name: 'chartType',
        message: 'What type of chart would you like?',
        choices: [
          {
            name: 'Time-series chart',
            value: 'timeseries',
          },
          {
            name: 'Regular chart',
            value: 'regular',
          },
        ],
      },
      {
        type: 'confirm',
        name: 'addBadges',
        message: "Add superset-ui badges to your plugin's README.md",
        default: true,
      },
    ]);
  }

  writing() {
    // 'hello-world' -> 'HelloWorld'
    const packageLabel = _.upperFirst(_.camelCase(this.answers.packageName));

    // 'hello-world' -> 'Hello World'
    const pluginName = _.startCase(_.camelCase(this.answers.packageName));

    const params = {
      ...this.answers,
      packageLabel,
      pluginName,
    };

    [
      ['package.erb', 'package.json'],
      ['tsconfig.json', 'tsconfig.json'],
      ['README.erb', 'README.md'],
      ['src/index.erb', 'src/index.ts'],
      ['src/plugin/buildQuery.erb', 'src/plugin/buildQuery.ts'],
      ['src/plugin/controlPanel.erb', 'src/plugin/controlPanel.ts'],
      ['src/plugin/index.erb', 'src/plugin/index.ts'],
      ['src/plugin/transformProps.erb', 'src/plugin/transformProps.ts'],
      ['src/types.erb', 'src/types.ts'],
      ['src/MyChart.erb', `src/${packageLabel}.tsx`],
      ['test/index.erb', 'test/index.test.ts'],
      ['test/plugin/buildQuery.test.erb', 'test/plugin/buildQuery.test.ts'],
      [
        'test/plugin/transformProps.test.erb',
        'test/plugin/transformProps.test.ts',
      ],
    ].forEach(([src, dest]) => {
      this.fs.copyTpl(
        this.templatePath(src),
        this.destinationPath(dest),
        params,
      );
    });

    ['types/external.d.ts', 'src/images/thumbnail.png'].forEach(file => {
      this.fs.copy(this.templatePath(file), this.destinationPath(file));
    });
  }
};
