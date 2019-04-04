'use strict';

const dirname = require('path').dirname;
const fs = require('graceful-fs');
const inspect = require('util').inspect;

const isPlainObj = require('is-plain-obj');
const mkdirpSync = require('mkdirp').sync;

const PATH_ERROR = 'Expected a file path to write a file';
const ENCODING_ERROR = 'Expected a string to be a valid encoding, for exmaple \'utf8\' and \'ascii\'';
const ENCODING_OPTION_ERROR = ENCODING_ERROR.replace('a string', '`encoding` option');
const COMMON_MESSAGE = 'option to be a positive integer or a string of octal code to specify';

const nameMessageMap = new Map([
	['mode', `Expected \`mode\` ${COMMON_MESSAGE} file and directory mode`],
	['fileMode', `Expected \`fileMode\` ${COMMON_MESSAGE} file mode`],
	['dirMode', `Expected \`dirMode\` ${COMMON_MESSAGE} directory mode`]
]);

module.exports = function outputFileSync(filePath, data, options) {
	if (typeof filePath !== 'string') {
		throw new TypeError(`${PATH_ERROR}, but got a non-string value ${inspect(filePath)}.`);
	}

	if (filePath.length === 0) {
		throw new Error(`${PATH_ERROR}, but got '' (empty string).`);
	}

	if (typeof data !== 'string' && !Buffer.isBuffer(data) && !(data instanceof Uint8Array)) {
		throw new TypeError(`Expected file content to be a string, Buffer or Uint8Array, but got ${
			inspect(data)
		} instead.`);
	}

	if (options !== null && options !== undefined) {
		if (typeof options === 'string') {
			if (options.length === 0) {
				throw new Error(`${ENCODING_ERROR}, but got '' (empty string).`);
			}

			if (!Buffer.isEncoding(options)) {
				throw new Error(`${ENCODING_ERROR}, but got ${inspect(options)} instead.`);
			}

			options = {encoding: options};
		} else if (!isPlainObj(options)) {
			throw new TypeError('Expected a string to specify file encoding or ' +
        `an object to specify output-file-sync options, but got ${inspect(options)}.`);
		}

		if (options.encoding !== null && options.encoding !== undefined) {
			if (typeof options.encoding !== 'string') {
				throw new TypeError(`${ENCODING_OPTION_ERROR}, but got ${inspect(options.encoding)} instead.`);
			}

			if (options.encoding.length === 0) {
				throw new Error(`${ENCODING_OPTION_ERROR}, but got '' (empty string).`);
			}

			if (!Buffer.isEncoding(options.encoding)) {
				throw new Error(`${ENCODING_OPTION_ERROR}, but got ${inspect(options.encoding)} instead.`);
			}
		}

		for (const pair of nameMessageMap) {
			const optionName = pair[0];
			const val = options[optionName];
			const message = pair[1];

			if (val !== undefined) {
				if (typeof val === 'number') {
					if (!isFinite(val)) {
						throw new RangeError(`${message}, but got ${val}.`);
					}

					if (val > Number.MAX_SAFE_INTEGER) {
						throw new RangeError(`${message}, but got a too large number.`);
					}

					if (val < 0) {
						throw new RangeError(`${message}, but got a negative number ${val}.`);
					}

					if (!Number.isInteger(val)) {
						throw new Error(`${message}, but got a non-integer number ${val}.`);
					}
				} else if (typeof val === 'string') {
					if (val.length === 0) {
						throw new Error(`${message}, but got '' (empty string).`);
					}

					const parsed = parseInt(val, 8);

					if (isNaN(parsed)) {
						throw new RangeError(`${message}, but got an invalid octal ${inspect(val)}.`);
					}

					if (parsed < 0) {
						throw new RangeError(`${message}, but got a negative octal ${inspect(val)}.`);
					}
				} else {
					throw new TypeError(`${message}, but got ${inspect(val)} instead.`);
				}
			}
		}
	} else {
		options = {};
	}

	const createdDirPath = mkdirpSync(dirname(filePath), options.dirMode !== undefined ? Object.assign({fs}, options, {
		mode: options.dirMode
	}) : options);

	fs.writeFileSync(filePath, data, options.fileMode !== undefined ? Object.assign({}, options, {
		mode: options.fileMode
	}) : options);

	return createdDirPath;
};
