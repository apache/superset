var fs = require('fs');
var pre = fs.readFileSync(__dirname + '/ag_pre.html', 'utf8');
var post = fs.readFileSync(__dirname + '/ag_post.html', 'utf8');
var ag = require('./ag.json');
console.log(pre + Object.keys(ag).sort().join('') + post);
