/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var loaderUtils = require("loader-utils");
var baseRegex = "\\s*[@#]\\s*sourceMappingURL=data:[^;\n]+;base64,([^\\s]*)",
	// Matches /* ... */ comments
	regex1 = new RegExp("/\\*"+baseRegex+"\\s*\\*/$"),
	// Matches // .... comments
	regex2 = new RegExp("//"+baseRegex+".*$");
module.exports = function(input) {
	if(!this.query) throw new Error("Pass a module name as query to the transform-loader.");
	var query = loaderUtils.getOptions(this) || {};
	var callback = this.async();
	var resource = this.resource;
	var loaderContext = this;
	var q = Object.keys(query)[0];
	if(/^[0-9]+$/.test(q)) {
		next(this.options.transforms[+q]);
	} else {
		this.resolve(this.context, q, function(err, module) {
			if(err) return callback(err);
			next(require(module));
		});
	}
	function next(transformFn) {
		var stream = transformFn(resource);
		var bufs = [];
		var done = false;
		stream.on("data", function(b) {
			bufs.push(Buffer.isBuffer(b) ? b : new Buffer(b));
		});
		stream.on("end", function() {
			if(done) return;
			var b = Buffer.concat(bufs).toString();
			var match = b.match(regex1) || b.match(regex2);
			try {
				var map = match && JSON.parse((new Buffer(match[1], "base64")).toString());
			} catch(e) {
				var map = null;
			}
			done = true;
			callback(null, map ? b.replace(match[0], "") : b, map);
		});
		stream.on("error", function(err) {
			if(done) return;
			done = true;
			callback(err);
		});
		stream.write(input);
		stream.end();
	}
};
module.exports.raw = true;
