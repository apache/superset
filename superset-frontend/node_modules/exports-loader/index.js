/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var loaderUtils = require("loader-utils");
var SourceNode = require("source-map").SourceNode;
var SourceMapConsumer = require("source-map").SourceMapConsumer;
var FOOTER = "/*** EXPORTS FROM exports-loader ***/\n";
module.exports = function(content, sourceMap) {
	if(this.cacheable) this.cacheable();
	var query = loaderUtils.getOptions(this) || {};
	var exports = [];
	var keys = Object.keys(query);
	// apply name interpolation i.e. substitute strings like [name] or [ext]
 	for (var i = 0; i < keys.length; i++) {
 		keys[i] = loaderUtils.interpolateName(this, keys[i], {});
 	};
	if(keys.length == 1 && typeof query[keys[0]] == "boolean") {
		exports.push("module.exports = " + keys[0] + ";");
	} else {
		keys.forEach(function(name) {
			var mod = name;
			if(typeof query[name] == "string") {
				mod = query[name];
			}
			exports.push("exports[" + JSON.stringify(name) + "] = (" + mod + ");");
		});
	}
	if(sourceMap) {
		var currentRequest = loaderUtils.getCurrentRequest(this);
		var node = SourceNode.fromStringWithSourceMap(content, new SourceMapConsumer(sourceMap));
		node.add("\n\n" + FOOTER + exports.join("\n"));
		var result = node.toStringWithSourceMap({
			file: currentRequest
		});
		this.callback(null, result.code, result.map.toJSON());
		return;
	}
	return content + "\n\n" + FOOTER + exports.join("\n");
}
