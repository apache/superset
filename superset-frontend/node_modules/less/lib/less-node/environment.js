module.exports = {
    encodeBase64: function encodeBase64(str) {
        return new Buffer(str).toString('base64');
    },
    mimeLookup: function (filename) {
        return require('mime').lookup(filename);
    },
    charsetLookup: function (mime) {
        return require('mime').charsets.lookup(mime);
    },
    getSourceMapGenerator: function getSourceMapGenerator() {
        return require('source-map').SourceMapGenerator;
    }
};
