/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
var fs = require("graceful-fs");

function NodeJsInputFileSystem() {}
module.exports = NodeJsInputFileSystem;

NodeJsInputFileSystem.prototype.isSync = function() {
	return false;
};

NodeJsInputFileSystem.prototype.stat = fs.stat.bind(fs);
NodeJsInputFileSystem.prototype.readdir = function readdir(path, callback) {
	fs.readdir(path, function (err, files) {
		callback(err, files && files.map(function (file) {
			return file.normalize ? file.normalize("NFC") : file;
		}));
	});
};
NodeJsInputFileSystem.prototype.readFile = fs.readFile.bind(fs);
NodeJsInputFileSystem.prototype.readlink = fs.readlink.bind(fs);