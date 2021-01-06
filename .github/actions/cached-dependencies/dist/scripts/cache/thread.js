'use strict';
const fs = require('fs');
const crypto = require('crypto');
const {parentPort} = require('worker_threads');

const handlers = {
	hashFile: (algorithm, filePath) => new Promise((resolve, reject) => {
		const hasher = crypto.createHash(algorithm);
		fs.createReadStream(filePath)
			// TODO: Use `Stream.pipeline` when targeting Node.js 12.
			.on('error', reject)
			.pipe(hasher)
			.on('error', reject)
			.on('finish', () => {
				const {buffer} = hasher.read();
				resolve({value: buffer, transferList: [buffer]});
			});
	}),
	hash: async (algorithm, input) => {
		const hasher = crypto.createHash(algorithm);

		if (Array.isArray(input)) {
			for (const part of input) {
				hasher.update(part);
			}
		} else {
			hasher.update(input);
		}

		const hash = hasher.digest().buffer;
		return {value: hash, transferList: [hash]};
	}
};

parentPort.on('message', async message => {
	try {
		const {method, args} = message;
		const handler = handlers[method];

		if (handler === undefined) {
			throw new Error(`Unknown method '${method}'`);
		}

		const {value, transferList} = await handler(...args);
		parentPort.postMessage({id: message.id, value}, transferList);
	} catch (error) {
		const newError = {message: error.message, stack: error.stack};

		for (const [key, value] of Object.entries(error)) {
			if (typeof value !== 'object') {
				newError[key] = value;
			}
		}

		parentPort.postMessage({id: message.id, error: newError});
	}
});
