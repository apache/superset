// IMPORTANT
// ---------
// This is an auto generated file with React CDK.
// Do not modify this file.

const parse = require('git-url-parse');
var ghUrl = process.argv[2];
const parsedUrl = parse(ghUrl);

const ghPagesUrl = 'https://' + parsedUrl.owner + '.github.io/' + parsedUrl.name;
console.log(ghPagesUrl);
