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
    this.fs.copy(this.templatePath('src/index.txt'), this.destinationPath(`src/index.${ext}`));
    this.fs.copy(
      this.templatePath('test/index.txt'),
      this.destinationPath(`test/index.test.${ext}`),
    );
  }
};
