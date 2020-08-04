module.exports = function() {

    var functionRegistry = require('./../less/functions/function-registry');

    function imageSize() {
        throw {
            type: 'Runtime',
            message: 'Image size functions are not supported in browser version of less'
        };
    }

    var imageFunctions = {
        'image-size': function(filePathNode) {
            imageSize(this, filePathNode);
            return -1;
        },
        'image-width': function(filePathNode) {
            imageSize(this, filePathNode);
            return -1;
        },
        'image-height': function(filePathNode) {
            imageSize(this, filePathNode);
            return -1;
        }
    };

    functionRegistry.addMultiple(imageFunctions);
};
