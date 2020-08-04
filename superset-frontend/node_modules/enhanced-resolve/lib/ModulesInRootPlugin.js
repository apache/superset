/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var createInnerCallback = require("./createInnerCallback");

function ModulesInRootPlugin(moduleType, path) {
	this.moduleType = moduleType;
	this.path = path;
}
module.exports = ModulesInRootPlugin;

ModulesInRootPlugin.prototype.apply = function(resolver) {
	var moduleType = this.moduleType;
	var path = this.path;
	resolver.plugin("module", function(request, callback) {
		this.applyPluginsParallelBailResult("module-" + moduleType, {
			path: path,
			request: request.request,
			query: request.query,
			directory: request.directory
		}, createInnerCallback(function innerCallback(err, result) {
			if(err) return callback(err);
			if(!result) return callback();
			return callback(null, result);
		}, callback, "looking for modules in " + path));
	});
};
