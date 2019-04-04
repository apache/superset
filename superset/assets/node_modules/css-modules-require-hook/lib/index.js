'use strict';

var _require = require('lodash'),
    assign = _require.assign,
    identity = _require.identity,
    negate = _require.negate;

var _require2 = require('path'),
    dirname = _require2.dirname,
    relative = _require2.relative,
    resolve = _require2.resolve;

var _require3 = require('fs'),
    readFileSync = _require3.readFileSync;

var _require4 = require('./transformTokens'),
    transformTokens = _require4.transformTokens;

var attachHook = require('./attachHook');
var genericNames = require('generic-names');
var globToRegex = require('glob-to-regexp');
var validate = require('./validate');

var postcss = require('postcss');
var Values = require('postcss-modules-values');
var LocalByDefault = require('postcss-modules-local-by-default');
var ExtractImports = require('postcss-modules-extract-imports');
var Scope = require('postcss-modules-scope');
var ResolveImports = require('postcss-modules-resolve-imports');

var debugFetch = require('debug')('css-modules:fetch');
var debugSetup = require('debug')('css-modules:setup');

module.exports = function setupHook(_ref) {
  var camelCase = _ref.camelCase,
      devMode = _ref.devMode,
      _ref$extensions = _ref.extensions,
      extensions = _ref$extensions === undefined ? '.css' : _ref$extensions,
      ignore = _ref.ignore,
      _ref$preprocessCss = _ref.preprocessCss,
      preprocessCss = _ref$preprocessCss === undefined ? identity : _ref$preprocessCss,
      processCss = _ref.processCss,
      processorOpts = _ref.processorOpts,
      _ref$append = _ref.append,
      append = _ref$append === undefined ? [] : _ref$append,
      _ref$prepend = _ref.prepend,
      prepend = _ref$prepend === undefined ? [] : _ref$prepend,
      createImportedName = _ref.createImportedName,
      generateScopedName = _ref.generateScopedName,
      hashPrefix = _ref.hashPrefix,
      mode = _ref.mode,
      resolveOpts = _ref.resolve,
      use = _ref.use,
      _ref$rootDir = _ref.rootDir,
      context = _ref$rootDir === undefined ? process.cwd() : _ref$rootDir;

  debugSetup(arguments[0]);
  validate(arguments[0]);

  var exts = toArray(extensions);
  var tokensByFile = {};

  // debug option is preferred NODE_ENV === 'development'
  var debugMode = typeof devMode !== 'undefined' ? devMode : process.env.NODE_ENV === 'development';

  var scopedName = void 0;
  if (generateScopedName) scopedName = typeof generateScopedName !== 'function' ? genericNames(generateScopedName, { context, hashPrefix }) //  for example '[name]__[local]___[hash:base64:5]'
  : generateScopedName;else
    // small fallback
    scopedName = function scopedName(local, filename) {
      return Scope.generateScopedName(local, relative(context, filename));
    };

  var plugins = use || [].concat(prepend, [Values, mode ? new LocalByDefault({ mode }) : LocalByDefault, createImportedName ? new ExtractImports({ createImportedName }) : ExtractImports, new Scope({ generateScopedName: scopedName }), new ResolveImports({ resolve: Object.assign({}, { extensions: exts }, resolveOpts) })], append);

  // https://github.com/postcss/postcss#options
  var runner = postcss(plugins);

  /**
   * @todo   think about replacing sequential fetch function calls with requires calls
   * @param  {string} _to
   * @param  {string} from
   * @return {object}
   */
  function fetch(_to, from) {
    // getting absolute path to the processing file
    var filename = /[^\\/?%*:|"<>.]/i.test(_to[0]) ? require.resolve(_to) : resolve(dirname(from), _to);

    // checking cache
    var tokens = tokensByFile[filename];
    if (tokens) {
      debugFetch(`${filename} → cache`);
      debugFetch(tokens);
      return tokens;
    }

    var source = preprocessCss(readFileSync(filename, 'utf8'), filename);
    // https://github.com/postcss/postcss/blob/master/docs/api.md#processorprocesscss-opts
    var lazyResult = runner.process(source, assign({}, processorOpts, { from: filename }));

    // https://github.com/postcss/postcss/blob/master/docs/api.md#lazywarnings
    lazyResult.warnings().forEach(function (message) {
      return console.warn(message.text);
    });

    tokens = lazyResult.root.exports || {};

    if (!debugMode)
      // updating cache
      tokensByFile[filename] = tokens;else
      // clearing cache in development mode
      delete require.cache[filename];

    if (processCss) processCss(lazyResult.css, filename);

    debugFetch(`${filename} → fs`);
    debugFetch(tokens);

    return tokens;
  }

  var isException = buildExceptionChecker(ignore);

  var hook = function hook(filename) {
    var tokens = fetch(filename, filename);
    return camelCase ? transformTokens(tokens, camelCase) : tokens;
  };

  // @todo add possibility to specify particular config for each extension
  exts.forEach(function (extension) {
    return attachHook(hook, extension, isException);
  });
};

/**
 * @param  {*} option
 * @return {array}
 */
function toArray(option) {
  return Array.isArray(option) ? option : [option];
}

/**
 * @param  {function|regex|string} ignore glob, regex or function
 * @return {function}
 */
function buildExceptionChecker(ignore) {
  if (ignore instanceof RegExp) return function (filepath) {
    return ignore.test(filepath);
  };

  if (typeof ignore === 'string') return function (filepath) {
    return globToRegex(ignore).test(filepath);
  };

  return ignore || negate(identity);
}