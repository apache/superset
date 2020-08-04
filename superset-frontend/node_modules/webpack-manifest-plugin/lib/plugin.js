var entries = require('object.entries');
var path = require('path');
var fse = require('fs-extra');
var _ = require('lodash');

const emitCountMap = new Map();
const compilerHookMap = new WeakMap();

const standardizeFilePaths = (file) => {
  file.name = file.name.replace(/\\/g, '/');
  file.path = file.path.replace(/\\/g, '/');
  return file;
};

function ManifestPlugin(opts) {
  this.opts = _.assign({
    publicPath: null,
    basePath: '',
    fileName: 'manifest.json',
    transformExtensions: /^(gz|map)$/i,
    writeToFileEmit: false,
    seed: null,
    filter: null,
    map: null,
    generate: null,
    sort: null,
    serialize: function(manifest) {
      return JSON.stringify(manifest, null, 2);
    },
  }, opts || {});
}

ManifestPlugin.getCompilerHooks = (compiler) => {
  var hooks = compilerHookMap.get(compiler);
  if (hooks === undefined) {
    const SyncWaterfallHook = require('tapable').SyncWaterfallHook;
    hooks = {
      afterEmit: new SyncWaterfallHook(['manifest'])
    };
    compilerHookMap.set(compiler, hooks);
  }
  return hooks;
}

ManifestPlugin.prototype.getFileType = function(str) {
  str = str.replace(/\?.*/, '');
  var split = str.split('.');
  var ext = split.pop();
  if (this.opts.transformExtensions.test(ext)) {
    ext = split.pop() + '.' + ext;
  }
  return ext;
};

ManifestPlugin.prototype.apply = function(compiler) {
  var moduleAssets = {};

  var outputFolder = compiler.options.output.path;
  var outputFile = path.resolve(outputFolder, this.opts.fileName);
  var outputName = path.relative(outputFolder, outputFile);

  var moduleAsset = function (module, file) {
    if (module.userRequest) {
      moduleAssets[file] = path.join(
        path.dirname(file),
        path.basename(module.userRequest)
      );
    }
  };


  var emit = function(compilation, compileCallback) {
    const emitCount = emitCountMap.get(outputFile) - 1
    emitCountMap.set(outputFile, emitCount);

    var seed = this.opts.seed || {};

    var publicPath = this.opts.publicPath != null ? this.opts.publicPath : compilation.options.output.publicPath;
    var stats = compilation.getStats().toJson({
        // Disable data generation of everything we don't use
        all: false,
        // Add asset Information
        assets: true,
        // Show cached assets (setting this to `false` only shows emitted files)
        cachedAssets: true,
    });

    var files = compilation.chunks.reduce(function(files, chunk) {
      return chunk.files.reduce(function (files, path) {
        var name = chunk.name ? chunk.name : null;

        if (name) {
          name = name + '.' + this.getFileType(path);
        } else {
          // For nameless chunks, just map the files directly.
          name = path;
        }

        // Webpack 4: .isOnlyInitial()
        // Webpack 3: .isInitial()
        // Webpack 1/2: .initial
        return files.concat({
          path: path,
          chunk: chunk,
          name: name,
          isInitial: chunk.isOnlyInitial ? chunk.isOnlyInitial() : (chunk.isInitial ? chunk.isInitial() : chunk.initial),
          isChunk: true,
          isAsset: false,
          isModuleAsset: false
        });
      }.bind(this), files);
    }.bind(this), []);

    // module assets don't show up in assetsByChunkName.
    // we're getting them this way;
    files = stats.assets.reduce(function (files, asset) {
      var name = moduleAssets[asset.name];
      if (name) {
        return files.concat({
          path: asset.name,
          name: name,
          isInitial: false,
          isChunk: false,
          isAsset: true,
          isModuleAsset: true
        });
      }

      var isEntryAsset = asset.chunks.length > 0;
      if (isEntryAsset) {
        return files;
      }

      return files.concat({
        path: asset.name,
        name: asset.name,
        isInitial: false,
        isChunk: false,
        isAsset: true,
        isModuleAsset: false
      });
    }, files);

    files = files.filter(function (file) {
      // Don't add hot updates to manifest
      var isUpdateChunk = file.path.indexOf('hot-update') >= 0;
      // Don't add manifest from another instance
      var isManifest = emitCountMap.get(path.join(outputFolder, file.name)) !== undefined;

      return !isUpdateChunk && !isManifest;
    });

    // Append optional basepath onto all references.
    // This allows output path to be reflected in the manifest.
    if (this.opts.basePath) {
      files = files.map(function(file) {
        file.name = this.opts.basePath + file.name;
        return file;
      }.bind(this));
    }

    if (publicPath) {
      // Similar to basePath but only affects the value (similar to how
      // output.publicPath turns require('foo/bar') into '/public/foo/bar', see
      // https://github.com/webpack/docs/wiki/configuration#outputpublicpath
      files = files.map(function(file) {
        file.path = publicPath + file.path;
        return file;
      }.bind(this));
    }

    files = files.map(standardizeFilePaths);

    if (this.opts.filter) {
      files = files.filter(this.opts.filter);
    }

    if (this.opts.map) {
      files = files.map(this.opts.map).map(standardizeFilePaths);
    }

    if (this.opts.sort) {
      files = files.sort(this.opts.sort);
    }

    var manifest;
    if (this.opts.generate) {
      const entrypointsArray = Array.from(
        compilation.entrypoints instanceof Map ?
          // Webpack 4+
          compilation.entrypoints.entries() :
          // Webpack 3
          entries(compilation.entrypoints)
      );
      const entrypoints = entrypointsArray.reduce(
        (e, [name, entrypoint]) => Object.assign(e, { [name]: entrypoint.getFiles() }),
        {}
      );
      manifest = this.opts.generate(seed, files, entrypoints);
    } else {
      manifest = files.reduce(function (manifest, file) {
        manifest[file.name] = file.path;
        return manifest;
      }, seed);
    }

    const isLastEmit = emitCount === 0
    if (isLastEmit) {
      var output = this.opts.serialize(manifest);

      compilation.assets[outputName] = {
        source: function() {
          return output;
        },
        size: function() {
          return output.length;
        }
      };

      if (this.opts.writeToFileEmit) {
        fse.outputFileSync(outputFile, output);
      }
    }

    if (compiler.hooks) {
      ManifestPlugin.getCompilerHooks(compiler).afterEmit.call(manifest);
    } else {
      compilation.applyPluginsAsync('webpack-manifest-plugin-after-emit', manifest, compileCallback);
    }
  }.bind(this);

  function beforeRun (compiler, callback) {
    let emitCount = emitCountMap.get(outputFile) || 0;
    emitCountMap.set(outputFile, emitCount + 1);

    if (callback) {
      callback();
    }
  }

  if (compiler.hooks) {
    const pluginOptions = {
      name: 'ManifestPlugin',
      stage: Infinity
    };

    // Preserve exposure of custom hook in Webpack 4 for back compatability.
    // Going forward, plugins should call `ManifestPlugin.getCompilerHooks(compiler)` directy.
    if (!Object.isFrozen(compiler.hooks)) {
      compiler.hooks.webpackManifestPluginAfterEmit = ManifestPlugin.getCompilerHooks(compiler).afterEmit;
    }

    compiler.hooks.compilation.tap(pluginOptions, function (compilation) {
      compilation.hooks.moduleAsset.tap(pluginOptions, moduleAsset);
    });
    compiler.hooks.emit.tap(pluginOptions, emit);

    compiler.hooks.run.tap(pluginOptions, beforeRun);
    compiler.hooks.watchRun.tap(pluginOptions, beforeRun);
  } else {
    compiler.plugin('compilation', function (compilation) {
      compilation.plugin('module-asset', moduleAsset);
    });
    compiler.plugin('emit', emit);

    compiler.plugin('before-run', beforeRun);
    compiler.plugin('watch-run', beforeRun);
  }
};

module.exports = ManifestPlugin;
