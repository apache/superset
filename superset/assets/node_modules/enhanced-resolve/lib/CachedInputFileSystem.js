/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
function Storage(duration) {
	this.duration = duration;
	this.running = {};
	this.data = {};
	this.levels = [];
	if(duration > 0) {
		this.levels.push([], [], [], [], [], [], [], [], []);
		for(var i = 8000; i < duration; i+=500)
			this.levels.push([]);
	}
	this.count = 0;
	this.interval = null;
	this.needTickCheck = false;
	this.nextTick = null;
	this.passive = true;
}

Storage.prototype.ensureTick = function() {
	if(!this.interval && this.duration > 0 && !this.nextTick)
		this.interval = setInterval(this.tick.bind(this), Math.floor(this.duration / this.levels.length));
};

Storage.prototype.finished = function(name) {
	var args = Array.prototype.slice.call(arguments, 1);
	var callbacks = this.running[name];
	delete this.running[name];
	if(this.duration > 0) {
		this.count++;
		this.data[name] = args;
		this.levels[0].push(name);
		this.ensureTick();
	}
	for(var i = 0; i < callbacks.length; i++) {
		callbacks[i].apply(null, args);
	}
};

Storage.prototype.provide = function(name, provider, callback) {
	var running = this.running[name];
	if(running) {
		running.push(callback);
		return;
	}
	if(this.duration > 0) {
		this.checkTicks();
		var data = this.data[name];
		if(data) {
			return callback.apply(null, data);
		}
	}
	this.running[name] = running = [callback];
	provider(name, this.finished.bind(this, name));
};

Storage.prototype.tick = function() {
	var decay = this.levels.pop();
	for(var i = decay.length - 1; i >= 0; i--) {
		delete this.data[decay[i]];
	}
	this.count -= decay.length;
	decay.length = 0;
	this.levels.unshift(decay);
	if(this.count == 0) {
		clearInterval(this.interval);
		this.interval = null;
		this.nextTick = null;
		return true;
	} else if(this.nextTick) {
		this.nextTick += Math.floor(this.duration / this.levels.length);
		var time = new Date().getTime();
		if(this.nextTick > time) {
			this.nextTick = null;
			this.interval = setInterval(this.tick.bind(this), Math.floor(this.duration / this.levels.length));
			return true;
		}
	} else if(this.passive) {
		clearInterval(this.interval);
		this.interval = null;
		this.nextTick = new Date().getTime() + Math.floor(this.duration / this.levels.length);
	} else {
		this.passive = true;
	}
};

Storage.prototype.checkTicks = function() {
	this.passive = false;
	if(this.nextTick) {
		while(!this.tick());
	}
};

Storage.prototype.purge = function(what) {
	if(!what) {
		this.count = 0;
		clearInterval(this.interval);
		this.nextTick = null;
		this.data = {};
		this.levels.forEach(function(level) {
			level.length = 0;
		});
	} else if(typeof what === "string") {
		Object.keys(this.data).forEach(function(key) {
			if(key.indexOf(what) === 0)
				delete this.data[key];
		}, this);
	} else {
		for(var i = what.length - 1; i >= 0; i--) {
			this.purge(what[i]);
		}
	}
};


function CachedInputFileSystem(fileSystem, duration) {
	this.fileSystem = fileSystem;
	this._statStorage = new Storage(duration);
	this._readdirStorage = new Storage(duration);
	this._readFileStorage = new Storage(duration);
	this._readlinkStorage = new Storage(duration);
}
module.exports = CachedInputFileSystem;

CachedInputFileSystem.prototype.isSync = function() {
	return this.fileSystem.isSync();
};

CachedInputFileSystem.prototype.stat = function(path, callback) {
	this._statStorage.provide(path, this.fileSystem.stat.bind(this.fileSystem), callback);
};

CachedInputFileSystem.prototype.readdir = function(path, callback) {
	this._readdirStorage.provide(path, this.fileSystem.readdir.bind(this.fileSystem), callback);
};

CachedInputFileSystem.prototype.readFile = function(path, callback) {
	this._readFileStorage.provide(path, this.fileSystem.readFile.bind(this.fileSystem), callback);
};

CachedInputFileSystem.prototype.readlink = function(path, callback) {
	this._readlinkStorage.provide(path, this.fileSystem.readlink.bind(this.fileSystem), callback);
};

CachedInputFileSystem.prototype.purge = function(what) {
	this._statStorage.purge(what);
	this._readdirStorage.purge(what);
	this._readFileStorage.purge(what);
	this._readlinkStorage.purge(what);
};