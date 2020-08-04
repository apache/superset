'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var fs = require('fs');
var path = require('path');
var url = require('url');

function buildManifest(compiler, compilation) {
  var context = compiler.options.context;
  var manifest = {};

  compilation.chunks.forEach(function (chunk) {
    chunk.files.forEach(function (file) {
      chunk.forEachModule(function (module) {
        var id = module.id;
        var name = typeof module.libIdent === 'function' ? module.libIdent({ context: context }) : null;
        var publicPath = url.resolve(compilation.outputOptions.publicPath || '', file);

        var currentModule = module;
        if (module.constructor.name === 'ConcatenatedModule') {
          currentModule = module.rootModule;
        }
        if (!manifest[currentModule.rawRequest]) {
          manifest[currentModule.rawRequest] = [];
        }

        manifest[currentModule.rawRequest].push({ id: id, name: name, file: file, publicPath: publicPath });
      });
    });
  });

  return manifest;
}

var ReactLoadablePlugin = function () {
  function ReactLoadablePlugin() {
    var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, ReactLoadablePlugin);

    this.filename = opts.filename;
  }

  ReactLoadablePlugin.prototype.apply = function apply(compiler) {
    var _this = this;

    compiler.plugin('emit', function (compilation, callback) {
      var manifest = buildManifest(compiler, compilation);
      var json = JSON.stringify(manifest, null, 2);
      var outputDirectory = path.dirname(_this.filename);
      try {
        fs.mkdirSync(outputDirectory);
      } catch (err) {
        if (err.code !== 'EEXIST') {
          throw err;
        }
      }
      fs.writeFileSync(_this.filename, json);
      callback();
    });
  };

  return ReactLoadablePlugin;
}();

function getBundles(manifest, moduleIds) {
  return moduleIds.reduce(function (bundles, moduleId) {
    return bundles.concat(manifest[moduleId]);
  }, []);
}

exports.ReactLoadablePlugin = ReactLoadablePlugin;
exports.getBundles = getBundles;