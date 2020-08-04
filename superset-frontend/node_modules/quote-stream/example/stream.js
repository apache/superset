var quote = require('../');
process.stdin.pipe(quote()).pipe(process.stdout);
