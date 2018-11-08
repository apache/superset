/* eslint-disable sort-keys */

const Generator = require('yeoman-generator');
const chalk = require('chalk');
const yosay = require('yosay');

module.exports = class extends Generator {
  async prompting() {
    // Have Yeoman greet the user.
    this.log(yosay(`Welcome to the rad ${chalk.red('generator-superset')} generator!`));

    this.option('skipInstall');

    this.answers = await this.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Package name:',
        default: this.appname.replace('superset ui ', ''), // Default to current folder name
      },
    ]);
  }

  writing() {
    this.fs.copyTpl(
      this.templatePath('package.json'),
      this.destinationPath('package.json'),
      this.answers,
    );
    this.fs.copyTpl(
      this.templatePath('README.md'),
      this.destinationPath('README.md'),
      this.answers,
    );
    this.fs.copy(this.templatePath('src/index.js'), this.destinationPath('src/index.js'));
    this.fs.copy(this.templatePath('test/index.js'), this.destinationPath('test/index.test.js'));
  }
};
