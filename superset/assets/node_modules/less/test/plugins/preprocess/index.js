(function(exports) {
    var preProcessor = function() {};

    preProcessor.prototype = {
        process : function (src, extra) {
            var injected = '@color: red;\n';
            var ignored = extra.imports.contentsIgnoredChars;
            var fileInfo = extra.fileInfo;
            ignored[fileInfo.filename] = ignored[fileInfo.filename] || 0;
            ignored[fileInfo.filename] += injected.length;
            return injected + src;
        }
    };

    exports.install = function(less, pluginManager) {
        pluginManager.addPreProcessor( new preProcessor() );
    };

})(typeof exports === 'undefined' ? this['preProcessorPlugin'] = {} : exports);
