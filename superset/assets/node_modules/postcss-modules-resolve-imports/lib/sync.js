'use strict';

/**
 * Notes about postcss plugin's api
 *
 * Containers are iterated with .walk* methods.
 * - Rule is actually a selector.
 * - AtRule usually is rule, that starts from '@'.
 * - Decl are actually css rules (keys prop, value).
 *
 * @see  http://api.postcss.org/AtRule.html#walkRules
 */

var _require = require('postcss'),
    plugin = _require.plugin;

var postcss = require('postcss');
var resolveDeps = require('./resolveDeps');

var extractPlugin = plugin('extract-plugin', function () {
  return resolveDeps;
});

module.exports = plugin('postcss-modules-resolve-imports', resolveImportsPlugin);

/**
 * dangerouslyPrevailCyclicDepsWarnings
 * icssExports
 * resolve.alias
 * resolve.extensions
 * resolve.modules
 */
function resolveImportsPlugin() {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      icssExports = _ref.icssExports,
      _ref$resolve = _ref.resolve,
      resolve = _ref$resolve === undefined ? {} : _ref$resolve;

  return resolveImports;

  function resolveImports(ast, result) {
    var graph = {};
    var processor = createProcessor(result.processor.plugins);
    var rootPath = ast.source.input.file;
    var rootTree = ast.clone({ nodes: [] });

    resolveDeps(ast, { opts: { from: rootPath, graph, resolve, rootPath, rootTree }, processor });

    if (icssExports) {
      var exportRule = postcss.rule({
        raws: {
          before: '',
          between: '\n',
          semicolon: true,
          after: '\n'
        },
        selector: ':export'
      });

      Object.keys(ast.exports).forEach(function (className) {
        return exportRule.append({
          prop: className,
          value: ast.exports[className],
          raws: { before: '\n  ' }
        });
      });

      rootTree.prepend(exportRule);
    }

    rootTree.exports = ast.exports;
    result.root = rootTree;
  }
}

function createProcessor(plugins) {
  var selfposition = plugins.findIndex(bySelfName);
  var precedingPlugins = plugins.slice(0, selfposition);

  return postcss(precedingPlugins.concat(extractPlugin));
}

function bySelfName(plugin) {
  return plugin.postcssPlugin === 'postcss-modules-resolve-imports';
}