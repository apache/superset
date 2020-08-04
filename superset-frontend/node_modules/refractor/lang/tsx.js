'use strict'
var refractorJsx = require('./jsx.js')
var refractorTypescript = require('./typescript.js')
module.exports = tsx
tsx.displayName = 'tsx'
tsx.aliases = []
function tsx(Prism) {
  Prism.register(refractorJsx)
  Prism.register(refractorTypescript)
  var typescript = Prism.util.clone(Prism.languages.typescript)
  Prism.languages.tsx = Prism.languages.extend('jsx', typescript)
}
