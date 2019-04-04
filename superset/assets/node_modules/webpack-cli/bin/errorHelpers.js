/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const webpackOptionsFlag = "WEBPACK_OPTIONS";

exports.cutOffByFlag = (stack, flag) => {
	stack = stack.split("\n");
	for (let i = 0; i < stack.length; i++)
		if (stack[i].indexOf(flag) >= 0) stack.length = i;
	return stack.join("\n");
};

exports.cutOffWebpackOptions = stack =>
	exports.cutOffByFlag(stack, webpackOptionsFlag);

exports.cutOffMultilineMessage = (stack, message) => {
	stack = stack.split("\n");
	message = message.split("\n");

	return stack
		.reduce(
			(acc, line, idx) =>
				line === message[idx] || line === `Error: ${message[idx]}`
					? acc
					: acc.concat(line),
			[]
		)
		.join("\n");
};

exports.cleanUpWebpackOptions = (stack, message) => {
	stack = exports.cutOffWebpackOptions(stack);
	stack = exports.cutOffMultilineMessage(stack, message);
	return stack;
};
