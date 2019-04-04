/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var popPathSeqment = require("./popPathSeqment");

function ResultSymlinkPlugin(appendings) {
}
module.exports = ResultSymlinkPlugin;

ResultSymlinkPlugin.prototype.apply = function(resolver) {
	resolver.plugin("result", function pluginMethod(request, callback) {
		var fs = this.fileSystem;
		var paths = [request.path];
		var pathSeqments = [];
		var addr = [request.path];
		var pathSeqment = popPathSeqment(addr);
		while(pathSeqment) {
			pathSeqments.push(pathSeqment);
			paths.push(addr[0]);
			pathSeqment = popPathSeqment(addr);
		}
		pathSeqments.push(paths[paths.length-1]);
		var log = callback.log;
		var missing = callback.missing;
		var containsSymlink = false;
		this.forEachBail(paths.map(function(_, i) { return i; }), function(idx, callback) {
			fs.readlink(paths[idx], function(err, result) {
				if(!err && result) {
					pathSeqments[idx] = result;
					containsSymlink = true;
					// Shortcut when absolute symlink found
					if(/^(\/|[a-zA-z]:($|\\))/.test(result))
						return callback(null, idx);
				}
				callback();
			});
		}, function(err, idx) {
			if(!containsSymlink) return callback();
			var resultSeqments = typeof idx === "number" ? pathSeqments.slice(0, idx+1) : pathSeqments.slice();
			var result = resultSeqments.reverse().reduce(function(a, b) {
				return this.join(a, b);
			}.bind(this));
			log("resolved symlink to " + result);
			request.path = result;
			pluginMethod.call(this, request, callback);
		}.bind(this));
	});
};