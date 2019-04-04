/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/

var normalize = require("./normalize");

function MemoryFileSystem(data) {
	this.data = data || {};
}
module.exports = MemoryFileSystem;

function isDir(item) {
	if(typeof item !== "object") return false;
	return item[""] === true;
}

function isFile(item) {
	if(typeof item !== "object") return false;
	return !item[""];
}

function pathToArray(path) {
	path = normalize(path);
	var nix = /^\//.test(path);
	if(!nix) {
		if(!/^[A-Za-z]:/.test(path)) throw new Error("Invalid path '" + path + "'");
		path = path.replace(/[\\\/]+/g, "\\"); // multi slashs
		path = path.split(/[\\\/]/);
		path[0] = path[0].toUpperCase();
	} else {
		path = path.replace(/\/+/g, "/"); // multi slashs
		path = path.substr(1).split("/");
	}
	if(!path[path.length-1]) path.pop();
	return path;
}

function trueFn() { return true; }
function falseFn() { return false; }

MemoryFileSystem.prototype.statSync = function(_path) {
	var path = pathToArray(_path);
	var current = this.data;
	for(var i = 0; i < path.length - 1; i++) {
		if(!isDir(current[path[i]]))
			throw new Error("Path doesn't exist '" + _path + "'");
		current = current[path[i]];
	}
	if(_path === "/" || isDir(current[path[i]])) {
		return {
			isFile: falseFn,
			isDirectory: trueFn,
			isBlockDevice: falseFn,
			isCharacterDevice: falseFn,
			isSymbolicLink: falseFn,
			isFIFO: falseFn,
			isSocket: falseFn
		};
	} else if(isFile(current[path[i]])) {
		return {
			isFile: trueFn,
			isDirectory: falseFn,
			isBlockDevice: falseFn,
			isCharacterDevice: falseFn,
			isSymbolicLink: falseFn,
			isFIFO: falseFn,
			isSocket: falseFn
		};
	} else
		throw new Error("Path doesn't exist '" + _path + "'");
};

MemoryFileSystem.prototype.readFileSync = function(_path, encoding) {
	var path = pathToArray(_path);
	var current = this.data;
	for(var i = 0; i < path.length - 1; i++) {
		if(!isDir(current[path[i]]))
			throw new Error("Path doesn't exist '" + _path + "'");
		current = current[path[i]];
	}
	if(!isFile(current[path[i]])) {
		if(isDir(current[path[i]]))
			throw new Error("Cannot readFile on directory '" + _path + "'");
		else
			throw new Error("Path doesn't exist '" + _path + "'");
	}
	current = current[path[i]];
	return encoding ? current.toString(encoding) : current;
};

MemoryFileSystem.prototype.readdirSync = function(_path) {
	if(_path === "/") return Object.keys(this.data).filter(Boolean);
	var path = pathToArray(_path);
	var current = this.data;
	for(var i = 0; i < path.length - 1; i++) {
		if(!isDir(current[path[i]]))
			throw new Error("Path doesn't exist '" + _path + "'");
		current = current[path[i]];
	}
	if(!isDir(current[path[i]])) {
		if(isFile(current[path[i]]))
			throw new Error("Cannot readdir on file '" + _path + "'");
		else
			throw new Error("Path doesn't exist '" + _path + "'");
	}
	return Object.keys(current[path[i]]).filter(Boolean);
};

MemoryFileSystem.prototype.mkdirpSync = function(_path) {
	var path = pathToArray(_path);
	if(path.length === 0) return;
	var current = this.data;
	for(var i = 0; i < path.length; i++) {
		if(isFile(current[path[i]]))
			throw new Error("Path is a file '" + _path + "'");
		else if(!isDir(current[path[i]]))
			current[path[i]] = {"":true};
		current = current[path[i]];
	}
	return;
};

MemoryFileSystem.prototype.mkdirSync = function(_path) {
	var path = pathToArray(_path);
	if(path.length === 0) return;
	var current = this.data;
	for(var i = 0; i < path.length - 1; i++) {
		if(!isDir(current[path[i]]))
			throw new Error("Path doesn't exist '" + _path + "'");
		current = current[path[i]];
	}
	if(isDir(current[path[i]]))
		throw new new Error("Directory already exist '" + _path + "'");
	else if(isFile(current[path[i]]))
		throw new Error("Cannot mkdir on file '" + _path + "'");
	current[path[i]] = {"":true};
	return;
};

MemoryFileSystem.prototype._remove = function(_path, name, testFn) {
	var path = pathToArray(_path);
	if(path.length === 0) throw new Error("Path cannot be removed '" + _path + "'");
	var current = this.data;
	for(var i = 0; i < path.length - 1; i++) {
		if(!isDir(current[path[i]]))
			throw new Error("Path doesn't exist '" + _path + "'");
		current = current[path[i]];
	}
	if(!testFn(current[path[i]]))
		throw new Error("'" + name + "' doesn't exist '" + _path + "'");
	delete current[path[i]];
	return;
};

MemoryFileSystem.prototype.rmdirSync = function(_path) {
	return this._remove(_path, "Directory", isDir);
};

MemoryFileSystem.prototype.unlinkSync = function(_path) {
	return this._remove(_path, "File", isFile);
};

MemoryFileSystem.prototype.readlinkSync = function(_path) {
	throw new Error("Path is not a link '" + _path + "'");
};

MemoryFileSystem.prototype.writeFileSync = function(_path, content, encoding) {
	if(!content && !encoding) throw new Error("No content");
	var path = pathToArray(_path);
	if(path.length === 0) throw new Error("Path is not a file '" + _path + "'");
	var current = this.data;
	for(var i = 0; i < path.length - 1; i++) {
		if(!isDir(current[path[i]]))
			throw new Error("Path doesn't exist '" + _path + "'");
		current = current[path[i]];
	}
	if(isDir(current[path[i]]))
		throw new Error("Cannot writeFile on directory '" + _path + "'");
	current[path[i]] = encoding || typeof content === "string" ? new Buffer(content, encoding) : content;
	return;
};

MemoryFileSystem.prototype.join = require("./join");

MemoryFileSystem.prototype.normalize = normalize;

// async functions

["stat", "readdir", "mkdirp", "mkdir", "rmdir", "unlink", "readlink"].forEach(function(fn) {
	MemoryFileSystem.prototype[fn] = function(path, callback) {
		try {
			var result = this[fn + "Sync"](path);
		} catch(e) {
			return callback(e);
		}
		return callback(null, result);
	};
});

MemoryFileSystem.prototype.readFile = function(path, optArg, callback) {
	if(!callback) {
		callback = optArg;
		optArg = undefined;
	}
	try {
		var result = this.readFileSync(path, optArg);
	} catch(e) {
		return callback(e);
	}
	return callback(null, result);
};

MemoryFileSystem.prototype.writeFile = function (path, content, encoding, callback) {
	if(!callback) {
		callback = encoding;
		encoding = undefined;
	}
	try {
		this.writeFileSync(path, content, encoding);
	} catch(e) {
		return callback(e);
	}
	return callback();
};
