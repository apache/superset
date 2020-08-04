module.exports = function(environment) {
    var Dimension = require('../less/tree/dimension'),
        Expression = require('../less/tree/expression'),
        functionRegistry = require('./../less/functions/function-registry');

    function imageSize(functionContext, filePathNode) {
        var filePath = filePathNode.value;
        var currentFileInfo = functionContext.currentFileInfo;
        var currentDirectory = currentFileInfo.rewriteUrls ?
        currentFileInfo.currentDirectory : currentFileInfo.entryPath;

        var fragmentStart = filePath.indexOf('#');
        var fragment = '';
        if (fragmentStart !== -1) {
            fragment = filePath.slice(fragmentStart);
            filePath = filePath.slice(0, fragmentStart);
        }

        var fileManager = environment.getFileManager(filePath, currentDirectory, functionContext.context, environment, true);

        if (!fileManager) {
            throw {
                type: 'File',
                message: 'Can not set up FileManager for ' + filePathNode
            };
        }

        var fileSync = fileManager.loadFileSync(filePath, currentDirectory, functionContext.context, environment);

        if (fileSync.error) {
            throw fileSync.error;
        }

        var sizeOf = require('image-size');
        return sizeOf(fileSync.filename);
    }

    var imageFunctions = {
        'image-size': function(filePathNode) {
            var size = imageSize(this, filePathNode);
            return new Expression([
                new Dimension(size.width, 'px'),
                new Dimension(size.height, 'px')
            ]);
        },
        'image-width': function(filePathNode) {
            var size = imageSize(this, filePathNode);
            return new Dimension(size.width, 'px');
        },
        'image-height': function(filePathNode) {
            var size = imageSize(this, filePathNode);
            return new Dimension(size.height, 'px');
        }
    };

    functionRegistry.addMultiple(imageFunctions);
};
