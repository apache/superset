var os = require('os');
var path = require('path');
var userHome = require('homedir-polyfill')();

var env = process.env;
var name = 'js-v8flags';

function macos() {
  var library = path.join(userHome, 'Library');
  return path.join(library, 'Caches', name);
}

function windows() {
  var appData = env.LOCALAPPDATA || path.join(userHome, 'AppData', 'Local');
  return path.join(appData, name);
}

// https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html
function linux() {
  var username = path.basename(userHome);
  return path.join(env.XDG_CACHE_HOME || path.join(userHome, '.cache'), name);
}

module.exports = function(platform) {
  if (!userHome) {
    return os.tmpdir();
  }

  if (platform === 'darwin') {
    return macos();
  }

  if (platform === 'win32') {
    return windows();
  }

  return linux();
};
