'use strict';
const fs = require('fs');
const stripBom = require('strip-bom');

module.exports = (module, filename) => {
	const content = fs.readFileSync(filename, 'utf8');

	try {
		module.exports = JSON.parse(stripBom(content));
	} catch (err) {
		err.message = `${filename}: ${err.message}`;
		throw err;
	}
};
