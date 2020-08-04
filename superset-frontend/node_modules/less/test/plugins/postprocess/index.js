(function(exports) {
    var postProcessor = function() {};

    postProcessor.prototype = {
        process: function (css) {
            return 'hr {height:50px;}\n' + css;
        }
    };

    exports.install = function(less, pluginManager) {
        pluginManager.addPostProcessor( new postProcessor());
    };

})(typeof exports === 'undefined' ? this['postProcessorPlugin'] = {} : exports);
