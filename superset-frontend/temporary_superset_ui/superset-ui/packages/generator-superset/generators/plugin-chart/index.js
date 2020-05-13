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
        default: _.upperFirst(_.startCase(this.appname.replace('plugin chart', '').trim())),
      },
    ]);
  }

  writing() {
    const packageLabel = _.upperFirst(_.camelCase(this.answers.packageName));

    const params = {
      ...this.answers,
      packageLabel,
    };

    [
      ['package.erb', 'package.json'],
      ['README.erb', 'README.md'],
      ['src/index.erb', 'src/index.ts'],
      ['src/plugin/index.erb', 'src/plugin/index.ts'],
      ['src/plugin/transformProps.txt', 'src/plugin/transformProps.ts'],
      ['src/MyChart.erb', `src/${packageLabel}.tsx`],
      ['test/index.erb', 'test/index.test.ts'],
    ].forEach(([src, dest]) => {
      this.fs.copyTpl(this.templatePath(src), this.destinationPath(dest), params);
    });

    ['types/external.d.ts', 'src/images/thumbnail.png'].forEach(file => {
      this.fs.copy(this.templatePath(file), this.destinationPath(file));
    });
  }
};
