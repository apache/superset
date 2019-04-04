'use strict';

var _require = require('postcss'),
    comment = _require.comment;

var _require2 = require('path'),
    dirname = _require2.dirname,
    relative = _require2.relative;

var _require3 = require('fs'),
    readFileSync = _require3.readFileSync;

var _require4 = require('./resolveModule'),
    resolveModule = _require4.resolveModule;

var _require5 = require('./resolvePaths'),
    resolvePaths = _require5.resolvePaths,
    normalizeUrl = _require5.normalizeUrl;

var _require6 = require('icss-utils'),
    replaceSymbols = _require6.replaceSymbols;

var PERMANENT_MARK = 2;
var TEMPORARY_MARK = 1;
// const UNMARKED = 0;

var importDeclaration = /^:import\((.+)\)$/;
var moduleDeclaration = /^:(?:export|import\(.+\))$/;

module.exports = resolveDeps;

/**
 * Topological sorting is used to resolve the deps order,
 * actually depth-first search algorithm.
 *
 * @see  https://en.wikipedia.org/wiki/Topological_sorting
 */
function resolveDeps(ast, result) {
  var _result$opts = result.opts,
      selfPath = _result$opts.from,
      graph = _result$opts.graph,
      resolve = _result$opts.resolve,
      rootPath = _result$opts.rootPath,
      rootTree = _result$opts.rootTree;


  var cwd = dirname(selfPath);
  var rootDir = dirname(rootPath);
  var processor = result.processor;
  var self = graph[selfPath] = graph[selfPath] || {};

  self.mark = TEMPORARY_MARK;

  var moduleExports = {};
  var translations = {};

  ast.walkRules(moduleDeclaration, function (rule) {
    if (importDeclaration.exec(rule.selector)) {
      rule.walkDecls(function (decl) {
        return translations[decl.prop] = decl.value;
      });

      var dependencyPath = RegExp.$1.replace(/['"]/g, '');
      var absDependencyPath = resolveModule(dependencyPath, { cwd, resolve });

      if (!absDependencyPath) throw new Error('Can\'t resolve module path from `' + cwd + '` to `' + dependencyPath + '`');

      if (graph[absDependencyPath] && graph[absDependencyPath].mark === TEMPORARY_MARK) throw new Error('Circular dependency was found between `' + selfPath + '` and `' + absDependencyPath + '`. ' + 'Circular dependencies lead to the unpredictable state and considered harmful.');

      if (!(graph[absDependencyPath] && graph[absDependencyPath].mark === PERMANENT_MARK)) {
        var css = readFileSync(absDependencyPath, 'utf8');
        var lazyResult = processor.process(css, Object.assign({}, result.opts, { from: absDependencyPath }));

        updateTranslations(translations, lazyResult.root.exports);
      } else {
        updateTranslations(translations, graph[absDependencyPath].exports);
      }

      return void rule.remove();
    }

    rule.walkDecls(function (decl) {
      return moduleExports[decl.prop] = decl.value;
    });
    rule.remove();
  });

  replaceSymbols(ast, translations);

  for (var token in moduleExports) {
    for (var genericId in translations) {
      moduleExports[token] = moduleExports[token].replace(genericId, translations[genericId]);
    }
  }self.mark = PERMANENT_MARK;
  self.exports = ast.exports = moduleExports;

  // resolve paths
  if (cwd !== rootDir) resolvePaths(ast, cwd, rootDir);

  var importNotes = comment({
    parent: rootTree,
    raws: { before: rootTree.nodes.length === 0 ? '' : '\n\n' },
    text: ` imported from ${normalizeUrl(relative(rootDir, selfPath))} `
  });

  var childNodes = ast.nodes.map(function (i) {
    var node = i.clone({ parent: rootTree });

    if (typeof node.raws.before === 'undefined' || node.raws.before === '') node.raws.before = '\n\n';

    return node;
  });

  rootTree.nodes = rootTree.nodes.concat(importNotes, childNodes);
}

function updateTranslations(translations, tokens) {
  for (var genericId in translations) {
    var token = translations[genericId];

    if (tokens.hasOwnProperty(token)) translations[genericId] = tokens[token];
  }
}