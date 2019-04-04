'use strict';
var fs = require('fs');

module.exports = function (filepath, pos, len, cb) {
	var buf = new Buffer(len);

	fs.open(filepath, 'r', function (err, fd) {
		if (err) {
			return cb(err);
		}

		fs.read(fd, buf, 0, len, pos, function (err, bytesRead, buf) {
			if (err) {
				return cb(err);
			}

			fs.close(fd, function (err) {
				if (err) {
					return cb(err);
				}

				if (bytesRead < len) {
					buf = buf.slice(0, bytesRead);
				}

				cb(null, buf);
			});
		});
	});
};

module.exports.sync = function (filepath, pos, len) {
	var buf = new Buffer(len);
	var fd = fs.openSync(filepath, 'r');
	var bytesRead = fs.readSync(fd, buf, 0, len, pos);
	fs.closeSync(fd);

	if (bytesRead < len) {
		buf = buf.slice(0, bytesRead);
	}

	return buf;
};
