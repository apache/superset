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
        default: _.kebabCase(this.appname.replace('superset ui legacy plugin chart', '').trim()), // Default to current folder name
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description:',
        default: _.upperFirst(
          _.startCase(this.appname.replace('superset ui legacy plugin chart', '').trim()),
        ), // Default to current folder name
      },
    ]);
  }

  writing() {
    this.fs.copyTpl(
      this.templatePath('_package.json'),
      this.destinationPath('package.json'),
      this.answers,
    );
    this.fs.copyTpl(this.templatePath('README.md'), this.destinationPath('README.md'), {
      ...this.answers,
      packageLabel: _.upperFirst(_.camelCase(this.answers.packageName)),
    });
  }
};
