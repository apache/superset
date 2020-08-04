module.exports = [
  // Note that the docs folder is called "embeddedDocs" and not "docs" to prevent issues
  // with yarn autoclean. See https://github.com/josdejong/mathjs/issues/969
  require('./embeddedDocs'),
  require('./function'),
  require('./node'),
  require('./transform'),

  require('./Help'),
  require('./parse'),
  require('./Parser')
];
