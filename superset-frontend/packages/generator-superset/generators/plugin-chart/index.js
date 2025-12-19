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

import Generator from 'yeoman-generator';
import { kebabCase, camelCase, startCase, upperFirst } from 'lodash-es';

export default class extends Generator {
  async prompting() {
    this.option('skipInstall');

    this.answers = await this.prompt([
      {
        type: 'input',
        name: 'packageName',
        message: 'Package name:',
        // Default to current folder name, e.g. superset-plugin-chart-hello-world
        default: kebabCase(this.appname),
      },
      {
        type: 'input',
        name: 'pluginName',
        message: 'Plugin name:',
        // Hello World
        default: startCase(
          camelCase(this.appname.replace('superset plugin chart', '').trim()),
        ),
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description:',
        // Superset Plugin Chart Hello World
        default: upperFirst(startCase(this.appname)),
      },
      {
        type: 'list',
        name: 'chartType',
        message: 'What type of chart would you like?',
        choices: [
          {
            name: 'Regular chart',
            value: 'regular',
          },
          {
            name: 'Time-series chart',
            value: 'timeseries',
          },
        ],
      },
    ]);
  }

  writing() {
    // SupersetPluginChartHelloWorld
    const packageLabel = upperFirst(camelCase(this.answers.packageName));

    const params = {
      ...this.answers,
      packageLabel,
    };

    [
      ['gitignore.erb', '.gitignore'],
      ['babel.config.erb', 'babel.config.js'],
      ['jest.config.erb', 'jest.config.js'],
      ['package.erb', 'package.json'],
      ['package-lock.erb', 'package-lock.json'],
      ['README.erb', 'README.md'],
      ['tsconfig.json', 'tsconfig.json'],
      ['src/index.erb', 'src/index.ts'],
      ['src/plugin/buildQuery.erb', 'src/plugin/buildQuery.ts'],
      ['src/plugin/controlPanel.erb', 'src/plugin/controlPanel.ts'],
      ['src/plugin/index.erb', 'src/plugin/index.ts'],
      ['src/plugin/transformProps.erb', 'src/plugin/transformProps.ts'],
      ['src/types.erb', 'src/types.ts'],
      ['src/MyChart.erb', `src/${packageLabel}.tsx`],
      ['test/index.erb', 'test/index.test.ts'],
      [
        'test/__mocks__/mockExportString.js',
        'test/__mocks__/mockExportString.js',
      ],
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
}
