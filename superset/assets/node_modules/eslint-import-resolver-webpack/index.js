var findRoot = require('find-root')
  , path = require('path')
  , get = require('lodash/get')
  , isEqual = require('lodash/isEqual')
  , find = require('array-find')
  , interpret = require('interpret')
  , fs = require('fs')
  , coreLibs = require('node-libs-browser')
  , resolve = require('resolve')
  , semver = require('semver')
  , has = require('has')

var log = require('debug')('eslint-plugin-import:resolver:webpack')

exports.interfaceVersion = 2

/**
 * Find the full path to 'source', given 'file' as a full reference path.
 *
 * resolveImport('./foo', '/Users/ben/bar.js') => '/Users/ben/foo.js'
 * @param  {string} source - the module to resolve; i.e './some-module'
 * @param  {string} file - the importing file's full path; i.e. '/usr/local/bin/file.js'
 * TODO: take options as a third param, with webpack config file name
 * @return {string?} the resolved path to source, undefined if not resolved, or null
 *                   if resolved to a non-FS resource (i.e. script tag at page load)
 */
exports.resolve = function (source, file, settings) {

  // strip loaders
  var finalBang = source.lastIndexOf('!')
  if (finalBang >= 0) {
    source = source.slice(finalBang + 1)
  }

  // strip resource query
  var finalQuestionMark = source.lastIndexOf('?')
  if (finalQuestionMark >= 0) {
    source = source.slice(0, finalQuestionMark)
  }

  if (source in coreLibs) {
    return { found: true, path: coreLibs[source] }
  }

  var webpackConfig

  var configPath = get(settings, 'config')
    , configIndex = get(settings, 'config-index')
    , env = get(settings, 'env')
    , packageDir

  log('Config path from settings:', configPath)

  // see if we've got a config path, a config object, an array of config objects or a config function
  if (!configPath || typeof configPath === 'string') {

      // see if we've got an absolute path
      if (!configPath || !path.isAbsolute(configPath)) {
        // if not, find ancestral package.json and use its directory as base for the path
        packageDir = findRoot(path.resolve(file))
        if (!packageDir) throw new Error('package not found above ' + file)
      }

      configPath = findConfigPath(configPath, packageDir)

      log('Config path resolved to:', configPath)
      if (configPath) {
        try {
          webpackConfig = require(configPath)
        } catch(e) {
          console.log('Error resolving webpackConfig', e)
          throw e
        }
      } else {
        log("No config path found relative to", file, "; using {}")
        webpackConfig = {}
      }

      if (webpackConfig && webpackConfig.default) {
        log('Using ES6 module "default" key instead of module.exports.')
        webpackConfig = webpackConfig.default
      }

  } else {
    webpackConfig = configPath
    configPath = null
  }

  if (typeof webpackConfig === 'function') {
    webpackConfig = webpackConfig(env)
  }

  if (Array.isArray(webpackConfig)) {
    if (typeof configIndex !== 'undefined' && webpackConfig.length > configIndex) {
      webpackConfig = webpackConfig[configIndex]
    }
    else {
      webpackConfig = find(webpackConfig, function findFirstWithResolve(config) {
        return !!config.resolve
      })
    }
  }

  log('Using config: ', webpackConfig)

  // externals
  if (findExternal(source, webpackConfig.externals, path.dirname(file))) {
    return { found: true, path: null }
  }

  // otherwise, resolve "normally"
  var resolveSync = getResolveSync(configPath, webpackConfig)

  try {
    return { found: true, path: resolveSync(path.dirname(file), source) }
  } catch (err) {
    log('Error during module resolution:', err)
    return { found: false }
  }
}

var MAX_CACHE = 10
var _cache = []
function getResolveSync(configPath, webpackConfig) {
  var cacheKey = { configPath: configPath, webpackConfig: webpackConfig }
  var cached = find(_cache, function (entry) { return isEqual(entry.key, cacheKey) })
  if (!cached) {
    cached = {
      key: cacheKey,
      value: createResolveSync(configPath, webpackConfig)
    }
    // put in front and pop last item
    if (_cache.unshift(cached) > MAX_CACHE) {
      _cache.pop()
    }
  }
  return cached.value
}

function createResolveSync(configPath, webpackConfig) {
  var webpackRequire
    , basedir = null

  if (typeof configPath === 'string') {
    basedir = path.dirname(configPath)
  }

  try {
    var webpackFilename = resolve.sync('webpack', { basedir, preserveSymlinks: false })
    var webpackResolveOpts = { basedir: path.dirname(webpackFilename), preserveSymlinks: false }

    webpackRequire = function (id) {
      return require(resolve.sync(id, webpackResolveOpts))
    }
  } catch (e) {
    // Something has gone wrong (or we're in a test). Use our own bundled
    // enhanced-resolve.
    log('Using bundled enhanced-resolve.')
    webpackRequire = require
  }

  var enhancedResolvePackage = webpackRequire('enhanced-resolve/package.json')
  var enhancedResolveVersion = enhancedResolvePackage.version
  log('enhanced-resolve version:', enhancedResolveVersion)

  var resolveConfig = webpackConfig.resolve || {}

  if (semver.major(enhancedResolveVersion) >= 2) {
    return createWebpack2ResolveSync(webpackRequire, resolveConfig)
  }

  return createWebpack1ResolveSync(webpackRequire, resolveConfig, webpackConfig.plugins)
}

function createWebpack2ResolveSync(webpackRequire, resolveConfig) {
  var EnhancedResolve = webpackRequire('enhanced-resolve')

  return EnhancedResolve.create.sync(Object.assign({}, webpack2DefaultResolveConfig, resolveConfig))
}

/**
 * webpack 2 defaults:
 * https://github.com/webpack/webpack/blob/v2.1.0-beta.20/lib/WebpackOptionsDefaulter.js#L72-L87
 * @type {Object}
 */
var webpack2DefaultResolveConfig = {
  unsafeCache: true, // Probably a no-op, since how can we cache anything at all here?
  modules: ['node_modules'],
  extensions: ['.js', '.json'],
  aliasFields: ['browser'],
  mainFields: ['browser', 'module', 'main'],
}

// adapted from tests &
// https://github.com/webpack/webpack/blob/v1.13.0/lib/WebpackOptionsApply.js#L322
function createWebpack1ResolveSync(webpackRequire, resolveConfig, plugins) {
  var Resolver = webpackRequire('enhanced-resolve/lib/Resolver')
  var SyncNodeJsInputFileSystem = webpackRequire('enhanced-resolve/lib/SyncNodeJsInputFileSystem')

  var ModuleAliasPlugin = webpackRequire('enhanced-resolve/lib/ModuleAliasPlugin')
  var ModulesInDirectoriesPlugin =
    webpackRequire('enhanced-resolve/lib/ModulesInDirectoriesPlugin')
  var ModulesInRootPlugin = webpackRequire('enhanced-resolve/lib/ModulesInRootPlugin')
  var ModuleAsFilePlugin = webpackRequire('enhanced-resolve/lib/ModuleAsFilePlugin')
  var ModuleAsDirectoryPlugin = webpackRequire('enhanced-resolve/lib/ModuleAsDirectoryPlugin')
  var DirectoryDescriptionFilePlugin =
    webpackRequire('enhanced-resolve/lib/DirectoryDescriptionFilePlugin')
  var DirectoryDefaultFilePlugin =
    webpackRequire('enhanced-resolve/lib/DirectoryDefaultFilePlugin')
  var FileAppendPlugin = webpackRequire('enhanced-resolve/lib/FileAppendPlugin')
  var ResultSymlinkPlugin = webpackRequire('enhanced-resolve/lib/ResultSymlinkPlugin')
  var DirectoryDescriptionFileFieldAliasPlugin =
    webpackRequire('enhanced-resolve/lib/DirectoryDescriptionFileFieldAliasPlugin')

  var resolver = new Resolver(new SyncNodeJsInputFileSystem())

  resolver.apply(
    resolveConfig.packageAlias
      ? new DirectoryDescriptionFileFieldAliasPlugin('package.json', resolveConfig.packageAlias)
      : function() {},
    new ModuleAliasPlugin(resolveConfig.alias || {}),
    makeRootPlugin(ModulesInRootPlugin, 'module', resolveConfig.root),
    new ModulesInDirectoriesPlugin(
      'module',
      resolveConfig.modulesDirectories || resolveConfig.modules || ['web_modules', 'node_modules']
    ),
    makeRootPlugin(ModulesInRootPlugin, 'module', resolveConfig.fallback),
    new ModuleAsFilePlugin('module'),
    new ModuleAsDirectoryPlugin('module'),
    new DirectoryDescriptionFilePlugin(
      'package.json',
      ['module', 'jsnext:main'].concat(resolveConfig.packageMains || webpack1DefaultMains)
    ),
    new DirectoryDefaultFilePlugin(['index']),
    new FileAppendPlugin(resolveConfig.extensions || ['', '.webpack.js', '.web.js', '.js']),
    new ResultSymlinkPlugin()
  )


  var resolvePlugins = []

  // support webpack.ResolverPlugin
  if (plugins) {
    plugins.forEach(function (plugin) {
      if (
        plugin.constructor &&
        plugin.constructor.name === 'ResolverPlugin' &&
        Array.isArray(plugin.plugins)
      ) {
        resolvePlugins.push.apply(resolvePlugins, plugin.plugins)
      }
    })
  }

  resolver.apply.apply(resolver, resolvePlugins)

  return function() {
    return resolver.resolveSync.apply(resolver, arguments)
  }
}

/* eslint-disable */
// from https://github.com/webpack/webpack/blob/v1.13.0/lib/WebpackOptionsApply.js#L365
function makeRootPlugin(ModulesInRootPlugin, name, root) {
  if(typeof root === "string")
    return new ModulesInRootPlugin(name, root);
  else if(Array.isArray(root)) {
    return function() {
      root.forEach(function(root) {
        this.apply(new ModulesInRootPlugin(name, root));
      }, this);
    };
  }
  return function() {};
}
/* eslint-enable */

function findExternal(source, externals, context) {
  if (!externals) return false

  // string match
  if (typeof externals === 'string') return (source === externals)

  // array: recurse
  if (externals instanceof Array) {
    return externals.some(function (e) { return findExternal(source, e, context) })
  }

  if (externals instanceof RegExp) {
    return externals.test(source)
  }

  if (typeof externals === 'function') {
    var functionExternalFound = false
    externals.call(null, context, source, function(err, value) {
      if (err) {
        functionExternalFound = false
      } else {
        functionExternalFound = findExternal(source, value, context)
      }
    })
    return functionExternalFound
  }

  // else, vanilla object
  for (var key in externals) {
    if (!has(externals, key)) continue
    if (source === key) return true
  }
  return false
}

/**
 * webpack 1 defaults: http://webpack.github.io/docs/configuration.html#resolve-packagemains
 * @type {Array}
 */
var webpack1DefaultMains = [
  'webpack', 'browser', 'web', 'browserify', ['jam', 'main'], 'main',
]

function findConfigPath(configPath, packageDir) {
  var extensions = Object.keys(interpret.extensions).sort(function(a, b) {
    return a === '.js' ? -1 : b === '.js' ? 1 : a.length - b.length
  })
    , extension


  if (configPath) {
    // extensions is not reused below, so safe to mutate it here.
    extensions.reverse()
    extensions.forEach(function (maybeExtension) {
      if (extension) {
        return
      }

      if (configPath.substr(-maybeExtension.length) === maybeExtension) {
        extension = maybeExtension
      }
    })

    // see if we've got an absolute path
    if (!path.isAbsolute(configPath)) {
      configPath = path.join(packageDir, configPath)
    }
  } else {
    extensions.forEach(function (maybeExtension) {
      if (extension) {
        return
      }

      var maybePath = path.resolve(
        path.join(packageDir, 'webpack.config' + maybeExtension)
      )
      if (fs.existsSync(maybePath)) {
        configPath = maybePath
        extension = maybeExtension
      }
    })
  }

  registerCompiler(interpret.extensions[extension])
  return configPath
}

function registerCompiler(moduleDescriptor) {
  if(moduleDescriptor) {
    if(typeof moduleDescriptor === 'string') {
      require(moduleDescriptor)
    } else if(!Array.isArray(moduleDescriptor)) {
      moduleDescriptor.register(require(moduleDescriptor.module))
    } else {
      for(var i = 0; i < moduleDescriptor.length; i++) {
        try {
          registerCompiler(moduleDescriptor[i])
          break
        } catch(e) {
          log('Failed to register compiler for moduleDescriptor[]:', i, moduleDescriptor)
        }
      }
    }
  }
}
