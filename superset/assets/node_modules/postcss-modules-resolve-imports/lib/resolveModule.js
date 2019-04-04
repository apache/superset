'use strict';

var _require = require('path'),
    join = _require.join,
    parse = _require.parse,
    resolve = _require.resolve;

var _require2 = require('fs'),
    readFileSync = _require2.readFileSync,
    statSync = _require2.statSync,
    realpathSync = _require2.realpathSync;

var minimist = require('minimist');

var argv = minimist(process.argv.slice(2), {
  boolean: ['preserve-symlinks']
});

var PRESERVE_SYMLINKS = argv['preserve-symlinks'] || String(process.env.NODE_PRESERVE_SYMLINKS) === '1';

exports.applyAliases = applyAliases;
exports.isDirectory = isDirectory;
exports.isFile = isFile;
exports.isNodeModule = isNodeModule;
exports.nodeModulesPaths = nodeModulesPaths;
exports.resolveAsDir = resolveAsDir;
exports.resolveAsFile = resolveAsFile;
exports.resolveModule = resolveModule;

function applyAliases(filepath) {
  var aliases = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  var keys = Object.keys(aliases);

  for (var i = 0; i < keys.length; ++i) {
    var key = keys[i];

    if (filepath.startsWith(key)) return filepath.replace(key, aliases[key]);
  }

  return filepath;
}

function isDirectory(filepath) {
  try {
    return statSync(filepath).isDirectory();
  } catch (er) {
    if (er && er.code === 'ENOENT') return false;
    throw er;
  }
}

function isFile(filepath) {
  try {
    return statSync(filepath).isFile();
  } catch (er) {
    if (er && er.code === 'ENOENT') return false;
    throw er;
  }
}

// ../ | ./ | / | c:\
function isNodeModule(filepath) {
  return !/^(?:\.\.?(?:[\\\/]|$)|\/|[A-Za-z]:[\\\/])/.test(filepath);
}

function nodeModulesPaths(start) {
  var paths = [start];
  var parsed = parse(start);

  while (parsed.dir !== parsed.root) {
    paths.push(parsed.dir);
    parsed = parse(parsed.dir);
  }

  paths.push(parsed.root);

  return paths.map(function (directory) {
    return join(directory, 'node_modules');
  });
}

function resolveAsDir(filepath) {
  var mainFile = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'index.css';

  var pkgfile = join(filepath, 'package.json');

  if (isFile(pkgfile)) {
    var body = readFileSync(pkgfile, 'utf8');

    try {
      var pkg = JSON.parse(body);

      if (pkg.main) return resolveAsFile(join(filepath, pkg.main)) || resolveAsDir(join(filepath, pkg.main), mainFile);
    } catch (e) {} // eslint-disable-line no-empty
  }

  return resolveAsFile(join(filepath, mainFile));
}

function resolveAsFile(filepath) {
  var extensions = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

  if (isFile(filepath)) return filepath;

  for (var i = 0; i < extensions.length; ++i) {
    var extension = extensions[i];
    var file = filepath + extension;

    if (file === filepath) continue;
    if (isFile(file)) return file;
  }
}

function resolveModule(filepath, _ref) {
  var cwd = _ref.cwd,
      _ref$resolve = _ref.resolve,
      resolvecfg = _ref$resolve === undefined ? {} : _ref$resolve;

  var preserveSymlinks = resolvecfg.preserveSymlinks !== undefined ? Boolean(resolvecfg.preserveSymlinks) : PRESERVE_SYMLINKS;
  var file = applyAliases(filepath, resolvecfg.alias);
  var dirs = isNodeModule(file) ? (resolvecfg.modules || []).concat(nodeModulesPaths(cwd)) : (resolvecfg.modules || []).concat(cwd);

  for (var i = 0; i < dirs.length; ++i) {
    var directory = dirs[i];

    if (!isDirectory(directory)) continue;

    var abspath = resolve(directory, file);
    var result = resolveAsFile(abspath, resolvecfg.extensions) || resolveAsDir(abspath, resolvecfg.mainFile);

    if (result) return preserveSymlinks ? result : realpathSync(result);
  }
}