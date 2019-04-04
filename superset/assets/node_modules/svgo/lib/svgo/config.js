'use strict';

var FS = require('fs');
var yaml = require('js-yaml');

/**
 * Read and/or extend/replace default config file,
 * prepare and optimize plugins array.
 *
 * @param {Object} [config] input config
 * @return {Object} output config
 */
module.exports = function(config) {

    var defaults;
    config = typeof config == 'object' && config || {};

    if (config.plugins && !Array.isArray(config.plugins)) {
        return { error: 'Error: Invalid plugins list. Provided \'plugins\' in config should be an array.' };
    }

    if (config.full) {
        defaults = config;

        if (Array.isArray(defaults.plugins)) {
            defaults.plugins = preparePluginsArray(defaults.plugins);
        }
    } else {
        defaults = Object.assign({}, yaml.safeLoad(FS.readFileSync(__dirname + '/../../.svgo.yml', 'utf8')));
        defaults.plugins = preparePluginsArray(defaults.plugins || []);
        defaults = extendConfig(defaults, config);
    }

    if ('floatPrecision' in config && Array.isArray(defaults.plugins)) {
        defaults.plugins.forEach(function(plugin) {
            if (plugin.params && ('floatPrecision' in plugin.params)) {
                // Don't touch default plugin params
                plugin.params = Object.assign({}, plugin.params, { floatPrecision: config.floatPrecision });
            }
        });
    }

    if ('datauri' in config) {
        defaults.datauri = config.datauri;
    }

    if (Array.isArray(defaults.plugins)) {
        defaults.plugins = optimizePluginsArray(defaults.plugins);
    }

    return defaults;

};

/**
 * Require() all plugins in array.
 *
 * @param {Array} plugins input plugins array
 * @return {Array} input plugins array of arrays
 */
function preparePluginsArray(plugins) {

    var plugin,
        key;

    return plugins.map(function(item) {

        // {}
        if (typeof item === 'object') {

            key = Object.keys(item)[0];

            // custom
            if (typeof item[key] === 'object' && item[key].fn && typeof item[key].fn === 'function') {
                plugin = setupCustomPlugin(key, item[key]);

            } else {

              plugin = Object.assign({}, require('../../plugins/' + key));

              // name: {}
              if (typeof item[key] === 'object') {
                  plugin.params = Object.assign({}, plugin.params || {}, item[key]);
                  plugin.active = true;

              // name: false
              } else if (item[key] === false) {
                 plugin.active = false;

              // name: true
              } else if (item[key] === true) {
                 plugin.active = true;
              }

              plugin.name = key;
            }

        // name
        } else {

            plugin = Object.assign({}, require('../../plugins/' + item));
            plugin.name = item;

        }

        return plugin;

    });

}

/**
 * Extend plugins with the custom config object.
 *
 * @param {Array} plugins input plugins
 * @param {Object} config config
 * @return {Array} output plugins
 */
function extendConfig(defaults, config) {

    var key;

    // plugins
    if (config.plugins) {

        config.plugins.forEach(function(item) {

            // {}
            if (typeof item === 'object') {

                key = Object.keys(item)[0];

                // custom
                if (typeof item[key] === 'object' && item[key].fn && typeof item[key].fn === 'function') {
                    defaults.plugins.push(setupCustomPlugin(key, item[key]));

                } else {
                    defaults.plugins.forEach(function(plugin) {

                        if (plugin.name === key) {
                            // name: {}
                            if (typeof item[key] === 'object') {
                                plugin.params = Object.assign({}, plugin.params || {}, item[key]);
                                plugin.active = true;

                            // name: false
                            } else if (item[key] === false) {
                               plugin.active = false;

                            // name: true
                            } else if (item[key] === true) {
                               plugin.active = true;
                            }
                        }
                    });
                }

            }

        });

    }

    defaults.multipass = config.multipass;

    // svg2js
    if (config.svg2js) {
        defaults.svg2js = config.svg2js;
    }

    // js2svg
    if (config.js2svg) {
        defaults.js2svg = config.js2svg;
    }

    return defaults;

}

/**
 * Setup and enable a custom plugin
 *
 * @param {String} plugin name
 * @param {Object} custom plugin
 * @return {Array} enabled plugin
 */
function setupCustomPlugin(name, plugin) {
    plugin.active = true;
    plugin.params = Object.assign({}, plugin.params || {});
    plugin.name = name;

    return plugin;
}

/**
 * Try to group sequential elements of plugins array.
 *
 * @param {Object} plugins input plugins
 * @return {Array} output plugins
 */
function optimizePluginsArray(plugins) {

    var prev;

    return plugins.reduce(function(plugins, item) {
        if (prev && item.type == prev[0].type) {
            prev.push(item);
        } else {
            plugins.push(prev = [item]);
        }
        return plugins;
    }, []);

}
