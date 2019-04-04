/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var createInnerCallback = require("./createInnerCallback");

function DirectoryDefaultFilePlugin(files) {
	this.files = files;
}
module.exports = DirectoryDefaultFilePlugin;

DirectoryDefaultFilePlugin.prototype.apply = function(resolver) {
	var files = this.files;
	resolver.plugin("directory", function(request, callback) {
		var fs = this.fileSystem;
		var topLevelCallback = callback;
		var directory = this.join(request.path, request.request);
		fs.stat(directory, function(err, stat) {
			if(err || !stat) {
				if(callback.log) callback.log(directory + " doesn't exist (directory default file)");
				return callback();
			}
			if(!stat.isDirectory()) {
				if(callback.log) callback.log(directory + " is not a directory (directory default file)");
				return callback();
			}
			this.forEachBail(files, function(file, callback) {
				this.doResolve("file", {
					path: directory,
					query: request.query,
					request: file
				}, createInnerCallback(function(err, result) {
					if(!err && result) return callback(result);
					return callback();
				}, topLevelCallback, "directory default file " + file));
			}.bind(this), function(result) {
				if(!result) return callback();
				return callback(null, result);
			});
		}.bind(this));
	});
};