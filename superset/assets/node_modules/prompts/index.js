module.exports =
  parseInt(process.versions.node, 10) < 8
    ? require('./dist/index.js')
    : require('./lib/index.js');
