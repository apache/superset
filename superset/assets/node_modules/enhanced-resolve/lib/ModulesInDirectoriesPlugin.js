/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var createInnerCallback = require("./createInnerCallback");
var popPathSeqment = require("./popPathSeqment");

function ModulesInDirectoriesPlugin(moduleType, directories) {
	this.moduleType = moduleType;
	this.directories = directories;
}
module.exports = ModulesInDirectoriesPlugin;

ModulesInDirectoriesPlugin.prototype.apply = function(resolver) {
	var moduleType = this.moduleType;
	var directories = this.directories;
	resolver.plugin("module", function(request, callback) {
		var fs = this.fileSystem;
		var paths = [request.path];
		var addr = [request.path];
		var pathSeqment = popPathSeqment(addr);
		var topLevelCallback = callback;
		while(pathSeqment) {
			paths.push(addr[0]);
			pathSeqment = popPathSeqment(addr);
		}
		var addrs = paths.map(function(p) {
			return directories.map(function(d) {
				return this.join(p, d);
			}, this);
		}, this).reduce(function(array, p) {
			array.push.apply(array, p);
			return array;
		}, []);
		this.forEachBail(addrs, function(addr, callback) {
			fs.stat(addr, function(err, stat) {
				if(!err && stat && stat.isDirectory()) {
					this.applyPluginsParallelBailResult("module-" + moduleType, {
						path: addr,
						request: request.request,
						query: request.query,
						directory: request.directory
					}, createInnerCallback(function(err, result) {
						if(err) return callback(err);
						if(!result) return callback();
						return callback(null, result);
					}, topLevelCallback, "looking for modules in " + addr));
					return;
				}
				return callback();
			}.bind(this));
		}.bind(this), function(err, result) {
			if(err) return callback(err);
			if(!result) return callback();
			return callback(null, result);
		});
	});
};
