'use strict';

var _require = require('css-selector-tokenizer'),
    parseValues = _require.parseValues,
    stringifyValues = _require.stringifyValues;

var _require2 = require('path'),
    relative = _require2.relative,
    resolve = _require2.resolve,
    sep = _require2.sep;

var isNonRootUrl = function isNonRootUrl(filepath) {
  return !/^\//.test(filepath);
};
var isRelativeUrl = function isRelativeUrl(filepath) {
  return (/^(?:\.\.?(?:[\\\/]|$))/.test(filepath)
  );
};

exports.normalizeUrl = normalizeUrl;
exports.isNonRootUrl = isNonRootUrl;
exports.isRelativeUrl = isRelativeUrl;
exports.iterateValues = iterateValues;
exports.resolvePaths = resolvePaths;

function normalizeUrl(value) {
  return value.replace(/\\/g, '/');
}

function iterateValues(values, iteratee) {
  values.nodes.forEach(function (value) {
    return value.nodes.forEach(function (item) {
      return iteratee(item);
    });
  });
}

function resolvePaths(ast, from, to) {
  // @import
  ast.walkAtRules(function (atrule) {
    if (atrule.name === 'import') {
      var values = parseValues(atrule.params);

      iterateValues(values, function (item) {
        if (item.type === 'string' && isNonRootUrl(item.value)) item.value = resolveUrl(item.value, from, to);

        if (item.type === 'url' && isNonRootUrl(item.url)) item.url = resolveUrl(item.url, from, to);
      });

      atrule.params = stringifyValues(values);
    }
  });

  // background: url(..)
  ast.walkDecls(function (decl) {
    if (/url/.test(decl.value)) {
      var values = parseValues(decl.value);

      iterateValues(values, function (item) {
        if (item.type === 'url' && isNonRootUrl(item.url)) item.url = resolveUrl(item.url, from, to);
      });

      decl.value = stringifyValues(values);
    }
  });
}

function resolveUrl(url, from, to) {
  var resolvedUrl = relative(to, resolve(from, url));

  return normalizeUrl(isRelativeUrl(url) ? '.' + sep + resolvedUrl : resolvedUrl);
}