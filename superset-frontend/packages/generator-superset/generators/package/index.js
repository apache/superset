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
        name: 'name',
        message: 'Package name:',
        default: _.kebabCase(this.appname.replace('superset ui', '').trim()), // Default to current folder name
      },
      {
        type: 'list',
        name: 'language',
        message: 'Choose language',
        default: 'typescript',
        choices: [
          {
            name: 'typescript',
            value: 'typescript',
            short: 't',
          },
          {
            name: 'javascript',
            value: 'javascript',
            short: 'j',
          },
        ],
      },
    ]);
  }

  writing() {
    this.fs.copyTpl(
      this.templatePath('_package.json'),
      this.destinationPath('package.json'),
      this.answers,
    );
    this.fs.copyTpl(
      this.templatePath('README.md'),
      this.destinationPath('README.md'),
      this.answers,
    );
    const ext = this.answers.language === 'typescript' ? 'ts' : 'js';
    this.fs.copy(
      this.templatePath('src/index.txt'),
      this.destinationPath(`src/index.${ext}`),
    );
    this.fs.copy(
      this.templatePath('test/index.txt'),
      this.destinationPath(`test/index.test.${ext}`),
    );
  }
};
