var PromiseConstructor,
    contexts = require('./contexts'),
    Parser = require('./parser/parser'),
    PluginManager = require('./plugin-manager'),
    LessError = require('./less-error'),
    utils = require('./utils');

module.exports = function(environment, ParseTree, ImportManager) {
    var parse = function (input, options, callback) {

        if (typeof options === 'function') {
            callback = options;
            options = utils.copyOptions(this.options, {});
        }
        else {
            options = utils.copyOptions(this.options, options || {});
        }

        if (!callback) {
            if (!PromiseConstructor) {
                PromiseConstructor = typeof Promise === 'undefined' ? require('promise') : Promise;
            }
            var self = this;
            return new PromiseConstructor(function (resolve, reject) {
                parse.call(self, input, options, function(err, output) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(output);
                    }
                });
            });
        } else {
            var context,
                rootFileInfo,
                pluginManager = new PluginManager(this, !options.reUsePluginManager);

            options.pluginManager = pluginManager;

            context = new contexts.Parse(options);

            if (options.rootFileInfo) {
                rootFileInfo = options.rootFileInfo;
            } else {
                var filename = options.filename || 'input';
                var entryPath = filename.replace(/[^\/\\]*$/, '');
                rootFileInfo = {
                    filename: filename,
                    rewriteUrls: context.rewriteUrls,
                    rootpath: context.rootpath || '',
                    currentDirectory: entryPath,
                    entryPath: entryPath,
                    rootFilename: filename
                };
                // add in a missing trailing slash
                if (rootFileInfo.rootpath && rootFileInfo.rootpath.slice(-1) !== '/') {
                    rootFileInfo.rootpath += '/';
                }
            }

            var imports = new ImportManager(this, context, rootFileInfo);
            this.importManager = imports;

            // TODO: allow the plugins to be just a list of paths or names
            // Do an async plugin queue like lessc

            if (options.plugins) {
                options.plugins.forEach(function(plugin) {
                    var evalResult, contents;
                    if (plugin.fileContent) {
                        contents = plugin.fileContent.replace(/^\uFEFF/, '');
                        evalResult = pluginManager.Loader.evalPlugin(contents, context, imports, plugin.options, plugin.filename);
                        if (evalResult instanceof LessError) {
                            return callback(evalResult);
                        }
                    }
                    else {
                        pluginManager.addPlugin(plugin);
                    }
                });
            }

            new Parser(context, imports, rootFileInfo)
                .parse(input, function (e, root) {
                    if (e) { return callback(e); }
                    callback(null, root, imports, options);
                }, options);
        }
    };
    return parse;
};
