/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/

"use strict";

const truncateArgs = require("../logging/truncateArgs");
const util = require("util");

const tty = process.stderr.isTTY && process.env.TERM !== "dumb";

let currentStatusMessage = undefined;
let hasStatusMessage = false;
let currentIndent = "";
let currentCollapsed = 0;

const indent = (str, prefix, colorPrefix, colorSuffix) => {
	if (str === "") return str;
	prefix = currentIndent + prefix;
	if (tty) {
		return (
			prefix +
			colorPrefix +
			str.replace(/\n/g, colorSuffix + "\n" + prefix + colorPrefix) +
			colorSuffix
		);
	} else {
		return prefix + str.replace(/\n/g, "\n" + prefix);
	}
};

const clearStatusMessage = () => {
	if (hasStatusMessage) {
		process.stderr.write("\x1b[2K\r");
		hasStatusMessage = false;
	}
};

const writeStatusMessage = () => {
	if (!currentStatusMessage) return;
	const l = process.stderr.columns;
	const args = l
		? truncateArgs(currentStatusMessage, l - 1)
		: currentStatusMessage;
	const str = args.join(" ");
	const coloredStr = `\u001b[1m${str}\u001b[39m\u001b[22m`;
	process.stderr.write(`\x1b[2K\r${coloredStr}`);
	hasStatusMessage = true;
};

const writeColored = (prefix, colorPrefix, colorSuffix) => {
	return (...args) => {
		if (currentCollapsed > 0) return;
		clearStatusMessage();
		// @ts-ignore
		const str = indent(util.format(...args), prefix, colorPrefix, colorSuffix);
		process.stderr.write(str + "\n");
		writeStatusMessage();
	};
};

const writeGroupMessage = writeColored(
	"<-> ",
	"\u001b[1m\u001b[36m",
	"\u001b[39m\u001b[22m"
);

const writeGroupCollapsedMessage = writeColored(
	"<+> ",
	"\u001b[1m\u001b[36m",
	"\u001b[39m\u001b[22m"
);

module.exports = {
	log: writeColored("    ", "\u001b[1m", "\u001b[22m"),
	debug: writeColored("    ", "", ""),
	trace: writeColored("    ", "", ""),
	info: writeColored("<i> ", "\u001b[1m\u001b[32m", "\u001b[39m\u001b[22m"),
	warn: writeColored("<w> ", "\u001b[1m\u001b[33m", "\u001b[39m\u001b[22m"),
	error: writeColored("<e> ", "\u001b[1m\u001b[31m", "\u001b[39m\u001b[22m"),
	logTime: writeColored("<t> ", "\u001b[1m\u001b[35m", "\u001b[39m\u001b[22m"),
	group: (...args) => {
		writeGroupMessage(...args);
		if (currentCollapsed > 0) {
			currentCollapsed++;
		} else {
			currentIndent += "  ";
		}
	},
	groupCollapsed: (...args) => {
		writeGroupCollapsedMessage(...args);
		currentCollapsed++;
	},
	groupEnd: () => {
		if (currentCollapsed > 0) currentCollapsed--;
		else if (currentIndent.length >= 2)
			currentIndent = currentIndent.slice(0, currentIndent.length - 2);
	},
	// eslint-disable-next-line node/no-unsupported-features/node-builtins
	profile: console.profile && (name => console.profile(name)),
	// eslint-disable-next-line node/no-unsupported-features/node-builtins
	profileEnd: console.profileEnd && (name => console.profileEnd(name)),
	clear:
		tty &&
		// eslint-disable-next-line node/no-unsupported-features/node-builtins
		console.clear &&
		(() => {
			clearStatusMessage();
			// eslint-disable-next-line node/no-unsupported-features/node-builtins
			console.clear();
			writeStatusMessage();
		}),
	status: tty
		? (name, ...args) => {
				args = args.filter(Boolean);
				if (name === undefined && args.length === 0) {
					clearStatusMessage();
					currentStatusMessage = undefined;
				} else if (
					typeof name === "string" &&
					name.startsWith("[webpack.Progress] ")
				) {
					currentStatusMessage = [name.slice(19), ...args];
					writeStatusMessage();
				} else if (name === "[webpack.Progress]") {
					currentStatusMessage = [...args];
					writeStatusMessage();
				} else {
					currentStatusMessage = [name, ...args];
					writeStatusMessage();
				}
		  }
		: writeColored("<s> ", "", "")
};
