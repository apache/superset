const Generator = require('yeoman-generator');

module.exports = class extends Generator {
  initializing() {
    // Redirect the default 'app' generator
    // to 'package' subgenerator
    // until there are multiple subgenerators
    // then this can be changed into a menu to select
    // subgenerator.
    this.composeWith(require.resolve('../package'));
  }
};
