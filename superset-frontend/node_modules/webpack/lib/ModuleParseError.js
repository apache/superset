/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const WebpackError = require("./WebpackError");

/** @typedef {import("./Module")} Module */

class ModuleParseError extends WebpackError {
	/**
	 * @param {Module} module the errored module
	 * @param {string} source source code
	 * @param {Error&any} err the parse error
	 * @param {string[]} loaders the loaders used
	 */
	constructor(module, source, err, loaders) {
		let message = "Module parse failed: " + err.message;
		let loc = undefined;
		if (loaders.length >= 1) {
			message += `\nFile was processed with these loaders:${loaders
				.map(loader => `\n * ${loader}`)
				.join("")}`;
			message +=
				"\nYou may need an additional loader to handle the result of these loaders.";
		} else {
			message +=
				"\nYou may need an appropriate loader to handle this file type, currently no loaders are configured to process this file. See https://webpack.js.org/concepts#loaders";
		}
		if (
			err.loc &&
			typeof err.loc === "object" &&
			typeof err.loc.line === "number"
		) {
			var lineNumber = err.loc.line;
			if (/[\0\u0001\u0002\u0003\u0004\u0005\u0006\u0007]/.test(source)) {
				// binary file
				message += "\n(Source code omitted for this binary file)";
			} else {
				const sourceLines = source.split(/\r?\n/);
				const start = Math.max(0, lineNumber - 3);
				const linesBefore = sourceLines.slice(start, lineNumber - 1);
				const theLine = sourceLines[lineNumber - 1];
				const linesAfter = sourceLines.slice(lineNumber, lineNumber + 2);
				message +=
					linesBefore.map(l => `\n| ${l}`).join("") +
					`\n> ${theLine}` +
					linesAfter.map(l => `\n| ${l}`).join("");
			}
			loc = err.loc;
		} else {
			message += "\n" + err.stack;
		}

		super(message);

		this.name = "ModuleParseError";
		this.module = module;
		this.loc = loc;
		this.error = err;

		Error.captureStackTrace(this, this.constructor);
	}
}

module.exports = ModuleParseError;
