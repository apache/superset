/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
function FileAppendPlugin(appendings) {
	this.appendings = appendings;
}
module.exports = FileAppendPlugin;

FileAppendPlugin.prototype.apply = function(resolver) {
	var appendings = this.appendings;
	resolver.plugin("file", function(request, callback) {
		var fs = this.fileSystem;
		var addr = this.join(request.path, request.request);
		var addrs = appendings.map(function(a) { return addr + a });
		var log = callback.log;
		var missing = callback.missing;
		this.forEachBail(addrs, function(addr, callback) {
			fs.stat(addr, function(err, stat) {
				if(!err && stat && stat.isFile())
					return callback(addr);
				if(missing && err)
					missing.push(addr);
				if(log) {
					if(err) log(addr + " doesn't exist");
					else log(addr + " is not a file");
				}
				return callback();
			});
		}, function(validAddr) {
			if(!validAddr) return callback();
			return this.doResolve("result", {
				path: validAddr,
				query: request.query,
				file: true,
				resolved: true
			}, callback);
		}.bind(this));
	});
};