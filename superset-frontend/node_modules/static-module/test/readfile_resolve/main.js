var fs = require('fs')
var src = fs.readFileSync(require.resolve('aaa/wow.txt'), 'utf8');
console.log(src);
