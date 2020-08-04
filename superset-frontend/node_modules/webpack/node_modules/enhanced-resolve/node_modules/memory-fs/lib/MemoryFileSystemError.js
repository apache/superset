
"use strict";

class MemoryFileSystemError extends Error {
	constructor(err, path, operation) {
		super(err, path);

		// Set `name` and `message` before call `Error.captureStackTrace` \
		// so that we will obtain the correct 1st line of stack, like:
		// [Error]: [Message]
		this.name = this.constructor.name;
		var message = [`${err.code}:`, `${err.description},`];
		// Add operation name and path into message, similar to node `fs` style.
		if(operation) {
			message.push(operation);
		}
		message.push(`\'${path}\'`);
		this.message = message.join(' ');

		this.code = err.code;
		this.errno = err.errno;
		this.path = path;
		this.operation = operation;

		if(Error.captureStackTrace) {
			Error.captureStackTrace(this, this.constructor);
		}
	}
}

module.exports = MemoryFileSystemError;
