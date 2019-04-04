/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
function ModuleAsFilePlugin(moduleType) {
	this.moduleType = moduleType;
}
module.exports = ModuleAsFilePlugin;

ModuleAsFilePlugin.prototype.apply = function(resolver) {
	resolver.plugin("module-" + this.moduleType, function(request, callback) {
		var fs = this.fileSystem;
		var i = request.request.indexOf("/"),
			j = request.request.indexOf("\\");
		if(i >= 0 || j >= 0 || request.directory) return callback();
		return this.doResolve("file", request, callback, true);
	});
};
