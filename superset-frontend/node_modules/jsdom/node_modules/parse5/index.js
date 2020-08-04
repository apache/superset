'use strict';

exports.Parser = require('./lib/tree_construction/parser');
exports.SimpleApiParser = require('./lib/simple_api/simple_api_parser');
exports.TreeSerializer =
exports.Serializer = require('./lib/serialization/serializer');
exports.JsDomParser = require('./lib/jsdom/jsdom_parser');

exports.TreeAdapters = {
    default: require('./lib/tree_adapters/default'),
    htmlparser2: require('./lib/tree_adapters/htmlparser2')
};
