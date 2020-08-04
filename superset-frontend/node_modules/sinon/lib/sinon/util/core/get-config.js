"use strict";

var defaultConfig = require("./default-config");
var hasOwnProperty = require("@sinonjs/commons").prototypes.object.hasOwnProperty;

module.exports = function getConfig(custom) {
    var config = {};
    var prop;
    var kustom = custom || {};

    for (prop in defaultConfig) {
        if (hasOwnProperty(defaultConfig, prop)) {
            config[prop] = hasOwnProperty(kustom, prop) ? kustom[prop] : defaultConfig[prop];
        }
    }

    return config;
};
