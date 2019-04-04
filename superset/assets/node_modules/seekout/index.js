'use strict';

var existsSync = require('fs').existsSync;
var resolve = require('path').resolve;
var sep = require('path').sep || '/';

/**
 * @param  {string} filename
 * @param  {string} [workdir]
 * @return {string|null}
 */
function seakout(filename, workdir) {
  var paths = getDirs(resolve(workdir || process.cwd()));
  var length = paths.length;
  var filepath;

  for (var i = 0; i < length; i++) {
    filepath = paths[i] + sep + filename;

    if (!existsSync(filepath)) {
      continue;
    }

    return filepath;
  }

  return null;
}

/**
 * @param  {string} directory
 * @return {string[]}
 */
function getDirs(directory) {
  var chunks = directory.split(sep);
  var paths = [];

  while (chunks.length) {
    paths.push(chunks.join(sep));
    chunks.pop();
  }

  return paths;
}

module.exports = seakout;
