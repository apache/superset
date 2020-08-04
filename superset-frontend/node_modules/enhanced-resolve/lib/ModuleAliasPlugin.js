/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var createInnerCallback = require("./createInnerCallback");

function ModuleAliasPlugin(aliasMap) {
	this.aliasMap = aliasMap;
}
module.exports = ModuleAliasPlugin;

ModuleAliasPlugin.prototype.apply = function(resolver) {
	var aliasMap = this.aliasMap;
	resolver.plugin("module", function(request, callback) {
		var fs = this.fileSystem;
		var keys = Object.keys(aliasMap);
		var i = 0;
		(function next() {
			for(;i < keys.length; i++) {
				var aliasName = keys[i];
				var onlyModule = /\$$/.test(aliasName);
				if(onlyModule) aliasName = aliasName.substr(0, aliasName.length-1);
				if((!onlyModule && request.request.indexOf(aliasName + "/") === 0) || request.request === aliasName) {
					var aliasValue = aliasMap[keys[i]];
					if(request.request.indexOf(aliasValue + "/") !== 0 && request.request != aliasValue) {
						var newRequestStr = aliasValue + request.request.substr(aliasName.length);
						var newRequest = this.parse(newRequestStr);
						var obj = {
							path: request.path,
							request: newRequest.path,
							query: newRequest.query,
							directory: newRequest.directory
						};
						var newCallback = createInnerCallback(callback, callback, "aliased with mapping " + JSON.stringify(aliasName) + ": " + JSON.stringify(aliasValue) + " to " + newRequestStr);
						if(newRequest.module) return this.doResolve("module", obj, newCallback);
						if(newRequest.directory) return this.doResolve("directory", obj, newCallback);
						return this.doResolve(["file", "directory"], obj, newCallback);
					}
				}
			}
			return callback();
		}.call(this));
	});
};
