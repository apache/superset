var shark = require('./'),
    fs = require('fs');

fs.createReadStream('README.md').pipe(shark()).pipe(process.stdout);
// console.log(shark(fs.readFileSync(('README.md'))));
