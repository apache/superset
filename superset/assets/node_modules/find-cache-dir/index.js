'use strict';
const path = require('path');
const commonDir = require('commondir');
const pkgDir = require('pkg-dir');
const makeDir = require('make-dir');

module.exports = options => {
	const name = options.name;
	let dir = options.cwd;

	if (options.files) {
		dir = commonDir(dir, options.files);
	} else {
		dir = dir || process.cwd();
	}

	dir = pkgDir.sync(dir);

	if (dir) {
		dir = path.join(dir, 'node_modules', '.cache', name);

		if (dir && options.create) {
			makeDir.sync(dir);
		}

		if (options.thunk) {
			return function () {
				return path.join.apply(path, [dir].concat(Array.prototype.slice.call(arguments)));
			};
		}
	}

	return dir;
};
