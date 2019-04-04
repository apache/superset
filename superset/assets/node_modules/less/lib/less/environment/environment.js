/**
 * @todo Document why this abstraction exists, and the relationship between
 *       environment, file managers, and plugin manager
 */

var logger = require('../logger');
var environment = function(externalEnvironment, fileManagers) {
    this.fileManagers = fileManagers || [];
    externalEnvironment = externalEnvironment || {};

    var optionalFunctions = ['encodeBase64', 'mimeLookup', 'charsetLookup', 'getSourceMapGenerator'],
        requiredFunctions = [],
        functions = requiredFunctions.concat(optionalFunctions);

    for (var i = 0; i < functions.length; i++) {
        var propName = functions[i],
            environmentFunc = externalEnvironment[propName];
        if (environmentFunc) {
            this[propName] = environmentFunc.bind(externalEnvironment);
        } else if (i < requiredFunctions.length) {
            this.warn('missing required function in environment - ' + propName);
        }
    }
};

environment.prototype.getFileManager = function (filename, currentDirectory, options, environment, isSync) {

    if (!filename) {
        logger.warn('getFileManager called with no filename.. Please report this issue. continuing.');
    }
    if (currentDirectory == null) {
        logger.warn('getFileManager called with null directory.. Please report this issue. continuing.');
    }

    var fileManagers = this.fileManagers;
    if (options.pluginManager) {
        fileManagers = [].concat(fileManagers).concat(options.pluginManager.getFileManagers());
    }
    for (var i = fileManagers.length - 1; i >= 0 ; i--) {
        var fileManager = fileManagers[i];
        if (fileManager[isSync ? 'supportsSync' : 'supports'](filename, currentDirectory, options, environment)) {
            return fileManager;
        }
    }
    return null;
};

environment.prototype.addFileManager = function (fileManager) {
    this.fileManagers.push(fileManager);
};

environment.prototype.clearFileManagers = function () {
    this.fileManagers = [];
};

module.exports = environment;
