var path = require('path'),
    PromiseConstructor = typeof Promise === 'undefined' ? require('promise') : Promise,
    AbstractPluginLoader = require('../less/environment/abstract-plugin-loader.js');

/**
 * Node Plugin Loader
 */
var PluginLoader = function(less) {
    this.less = less;
    this.require = function(prefix) {
        prefix = path.dirname(prefix);
        return function(id) {
            var str = id.substr(0, 2);
            if (str === '..' || str === './') {
                return require(path.join(prefix, id));
            }
            else {
                return require(id);
            }
        };
    };
};

PluginLoader.prototype = new AbstractPluginLoader();

PluginLoader.prototype.loadPlugin = function(filename, basePath, context, environment, fileManager) {
    var prefix = filename.slice(0, 1);
    var explicit = prefix === '.' || prefix === '/' || filename.slice(-3).toLowerCase() === '.js';
    if (!explicit) {
        context.prefixes = ['less-plugin-', ''];
    }

    return new PromiseConstructor(function(fulfill, reject) {
        fileManager.loadFile(filename, basePath, context, environment).then(
            function(data) {
                try {
                    fulfill(data);
                }
                catch (e) {
                    console.log(e);
                    reject(e);
                }
            }
        ).catch(function(err) {
            reject(err);
        });
    });

};

module.exports = PluginLoader;

