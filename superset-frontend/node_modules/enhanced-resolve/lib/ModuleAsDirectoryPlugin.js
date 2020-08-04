/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
function ModuleAsDirectoryPlugin(moduleType) {
	this.moduleType = moduleType;
}
module.exports = ModuleAsDirectoryPlugin;

ModuleAsDirectoryPlugin.prototype.apply = function(resolver) {
	resolver.plugin("module-" + this.moduleType, function(request, callback) {
		var fs = this.fileSystem;
		var i = request.request.indexOf("/"),
			j = request.request.indexOf("\\");
		var p = i < 0 ? j : j < 0 ? i : i < j ? i : j;
		var moduleName, remainingRequest;
		if(p < 0) {
			moduleName = request.request;
			remainingRequest = "";
		} else {
			moduleName = request.request.substr(0, p);
			remainingRequest = request.request.substr(p+1);
		}
		var modulePath = this.join(request.path, moduleName);
		fs.stat(modulePath, function(err, stat) {
			if(err || !stat) {
				if(callback.missing)
					callback.missing.push(modulePath);
				if(callback.log) callback.log(modulePath + " doesn't exist (module as directory)");
				return callback();
			}
			if(stat.isDirectory()) {
				return this.doResolve(request.directory ? "directory" : ["file", "directory"], {
					path: modulePath,
					request: remainingRequest,
					query: request.query
				}, callback, true);
			}
			if(callback.log) callback.log(modulePath + " is not a directory (module as directory)");
			return callback();
		}.bind(this));
	});
};
