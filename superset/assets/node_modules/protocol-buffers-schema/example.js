var schema = require('./')
var fs = require('fs')

var sch = schema.parse(fs.readFileSync('example.proto'))

console.log('Parsed schema:')
console.log(JSON.stringify(sch, null, 2))
console.log('')

console.log('Stringified schema:')
console.log(schema.stringify(sch))
