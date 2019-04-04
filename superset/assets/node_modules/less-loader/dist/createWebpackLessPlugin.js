'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/* eslint-disable class-methods-use-this */
var less = require('less');
var loaderUtils = require('loader-utils');
var pify = require('pify');

var stringifyLoader = require.resolve('./stringifyLoader.js');
var trailingSlash = /[/\\]$/;
var isLessCompatible = /\.(le|c)ss$/;

// Less automatically adds a .less file extension if no extension was given.
// This is problematic if there is a module request like @import "~some-module";
// because in this case Less will call our file manager with `~some-module.less`.
// Since dots in module names are highly discouraged, we can safely assume that
// this is an error and we need to remove the .less extension again.
// However, we must not match something like @import "~some-module/file.less";
var matchMalformedModuleFilename = /(~[^/\\]+)\.less$/;

// This somewhat changed in Less 3.x. Now the file name comes without the
// automatically added extension whereas the extension is passed in as `options.ext`.
// So, if the file name matches this regexp, we simply ignore the proposed extension.
var isModuleName = /^~[^/\\]+$/;

/**
 * Creates a Less plugin that uses webpack's resolving engine that is provided by the loaderContext.
 *
 * @param {LoaderContext} loaderContext
 * @param {string=} root
 * @returns {LessPlugin}
 */
function createWebpackLessPlugin(loaderContext) {
  var fs = loaderContext.fs;

  var resolve = pify(loaderContext.resolve.bind(loaderContext));
  var loadModule = pify(loaderContext.loadModule.bind(loaderContext));
  var readFile = pify(fs.readFile.bind(fs));

  var WebpackFileManager = function (_less$FileManager) {
    _inherits(WebpackFileManager, _less$FileManager);

    function WebpackFileManager() {
      _classCallCheck(this, WebpackFileManager);

      return _possibleConstructorReturn(this, (WebpackFileManager.__proto__ || Object.getPrototypeOf(WebpackFileManager)).apply(this, arguments));
    }

    _createClass(WebpackFileManager, [{
      key: 'supports',
      value: function supports() {
        // Our WebpackFileManager handles all the files
        return true;
      }

      // Sync resolving is used at least by the `data-uri` function.
      // This file manager doesn't know how to do it, so let's delegate it
      // to the default file manager of Less.
      // We could probably use loaderContext.resolveSync, but it's deprecated,
      // see https://webpack.js.org/api/loaders/#this-resolvesync

    }, {
      key: 'supportsSync',
      value: function supportsSync() {
        return false;
      }
    }, {
      key: 'loadFile',
      value: function loadFile(filename, currentDirectory, options) {
        var url = void 0;
        if (less.version[0] >= 3) {
          if (options.ext && !isModuleName.test(filename)) {
            url = this.tryAppendExtension(filename, options.ext);
          } else {
            url = filename;
          }
        } else {
          url = filename.replace(matchMalformedModuleFilename, '$1');
        }
        var moduleRequest = loaderUtils.urlToRequest(url, url.charAt(0) === '/' ? '' : null);
        // Less is giving us trailing slashes, but the context should have no trailing slash
        var context = currentDirectory.replace(trailingSlash, '');
        var resolvedFilename = void 0;

        return resolve(context, moduleRequest).then(function (f) {
          resolvedFilename = f;
          loaderContext.addDependency(resolvedFilename);

          if (isLessCompatible.test(resolvedFilename)) {
            return readFile(resolvedFilename).then(function (contents) {
              return contents.toString('utf8');
            });
          }

          return loadModule([stringifyLoader, resolvedFilename].join('!')).then(JSON.parse);
        }).then(function (contents) {
          return {
            contents,
            filename: resolvedFilename
          };
        });
      }
    }]);

    return WebpackFileManager;
  }(less.FileManager);

  return {
    install(lessInstance, pluginManager) {
      pluginManager.addFileManager(new WebpackFileManager());
    },
    minVersion: [2, 1, 1]
  };
}

module.exports = createWebpackLessPlugin;