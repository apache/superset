/* eslint-disable sort-keys */

const Generator = require('yeoman-generator');
const chalk = require('chalk');
const yosay = require('yosay');
const _ = require('lodash');

module.exports = class extends Generator {
  async prompting() {
    // Have Yeoman greet the user.
    this.log(yosay(`Welcome to the rad ${chalk.red('generator-superset')} generator!`));

    this.option('skipInstall');

    this.answers = await this.prompt([
      {
        type: 'input',
        name: 'packageName',
        message: 'Package name:',
        default: _.kebabCase(this.appname.replace('legacy plugin chart', '').trim()), // Default to current folder name
      },
      {
        type: 'input',
        name: 'packageLabel',
        message: 'Package label:',
        default: _.upperFirst(_.camelCase(this.appname.replace('legacy plugin chart', '').trim())), // Default to current folder name
      },
    ]);
  }

  writing() {
    this.fs.copyTpl(this.templatePath('index.js'), this.destinationPath('index.js'), this.answers);
    this.fs.copyTpl(
      this.templatePath('Stories.jsx'),
      this.destinationPath('Stories.jsx'),
      this.answers,
    );
  }
};
