/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var createInnerCallback = require("./createInnerCallback");

function DirectoryDescriptionFileFieldAliasPlugin(filename, field) {
	this.filename = filename;
	this.field = field;
}
module.exports = DirectoryDescriptionFileFieldAliasPlugin;

function findDescriptionFileField(resolver, directory, filename, field, callback) {
	(function findDescriptionFile() {
		var descriptionFilePath = resolver.join(directory, filename);
		resolver.fileSystem.readFile(descriptionFilePath, function(err, content) {
			if(err) {
				directory = cdUp(directory);
				if(!directory) {
					return callback();
				} else {
					return findDescriptionFile();
				}
			}
			try {
				content = JSON.parse(content);
			} catch(e) {
				if(callback.log)
					callback.log(descriptionFilePath + " (directory description file): " + e);
				else
					e.message = descriptionFilePath + " (directory description file): " + e;
				return callback(e);
			}
			var fieldData;
			if(Array.isArray(field)) {
				var current = content;
				for(var j = 0; j < field.length; j++) {
					if(current === null || typeof current !== "object") {
						current = null;
						break;
					}
					current = current[field[j]];
				}
				if(typeof current === "object") {
					fieldData = current;
				}
			} else {
				if(typeof content[field] === "object") {
					fieldData = content[field];
				}
			}
			if(!fieldData) return callback();
			callback(null, fieldData, directory);
		});
	}());
}

function cdUp(directory) {
	if(directory === "/") return null;
	var i = directory.lastIndexOf("/"),
		j = directory.lastIndexOf("\\");
	var p = i < 0 ? j : j < 0 ? i : i < j ? j : i;
	if(p < 0) return null;
	return directory.substr(0, p || 1);
}

DirectoryDescriptionFileFieldAliasPlugin.prototype.apply = function(resolver) {
	var filename = this.filename;
	var field = this.field;
	resolver.plugin("module", function(request, callback) {
		var directory = request.path;
		var moduleName = request.request;
		findDescriptionFileField(this, directory, filename, field, function(err, fieldData, directory) {
			if(err) return callback(err);
			if(!fieldData) return callback();
			var data = fieldData[moduleName];
			if(data === moduleName) return callback();
			if(data === false) return callback(null, {
				path: false,
				resolved: true
			});
			if(!data) return callback();
			var newRequest = this.parse(data);
			var obj = {
				path: directory,
				request: newRequest.path,
				query: newRequest.query,
				directory: newRequest.directory
			};
			var newCallback = createInnerCallback(callback, callback, "aliased from directory description file " + this.join(directory, filename) + " with mapping " + JSON.stringify(moduleName));
			if(newRequest.module) return this.doResolve("module", obj, newCallback);
			if(newRequest.directory) return this.doResolve("directory", obj, newCallback);
			return this.doResolve(["file", "directory"], obj, newCallback);
		}.bind(this));
	});
	resolver.plugin("result", function(request, callback) {
		var directory = cdUp(request.path);
		var requestPath = request.path;
		findDescriptionFileField(this, directory, filename, field, function(err, fieldData, directory) {
			if(err) return callback(err);
			if(!fieldData) return callback();
			var relative = requestPath.substr(directory.length+1).replace(/\\/g, "/");
			if(typeof fieldData[relative] !== "undefined")
				var data = fieldData[relative];
			else if(typeof fieldData["./" + relative] !== "undefined")
				var data = fieldData["./" + relative];
			if(data === relative || data === "./" + relative) return callback();
			if(data === false) return callback(null, {
				path: false,
				resolved: true
			});
			if(!data) return callback();
			var newRequest = this.parse(data);
			var obj = {
				path: directory,
				request: newRequest.path,
				query: newRequest.query,
				directory: newRequest.directory
			};
			var newCallback = createInnerCallback(callback, callback, "aliased from directory description file " + this.join(directory, filename) + " with mapping " + JSON.stringify(relative));
			if(newRequest.module) return this.doResolve("module", obj, newCallback);
			if(newRequest.directory) return this.doResolve("directory", obj, newCallback);
			return this.doResolve(["file", "directory"], obj, newCallback);
		}.bind(this));
	});
};
