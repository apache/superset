/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
function DirectoryResultPlugin(files) {
	this.files = files;
}
module.exports = DirectoryResultPlugin;

DirectoryResultPlugin.prototype.apply = function(resolver) {
	var files = this.files;
	resolver.plugin("directory", function(request, callback) {
		var fs = this.fileSystem;
		var directory = this.join(request.path, request.request);
		fs.stat(directory, function(err, stat) {
			if(!err && stat && stat.isDirectory()) {
				return this.doResolve("result", {
					path: directory,
					query: request.query,
					directory: true,
					resolved: true
				}, callback);
			}
			if(callback.log) {
				if(err) callback.log(directory + " doesn't exist");
				else callback.log(directory + " is not a directory");
			}
			return callback();
		}.bind(this));
	});
};