'use strict';
const SPACES_REGEXP = / +/g;

const joinCommand = (file, args = []) => {
	if (!Array.isArray(args)) {
		return file;
	}

	return [file, ...args].join(' ');
};

// Allow spaces to be escaped by a backslash if not meant as a delimiter
const handleEscaping = (tokens, token, index) => {
	if (index === 0) {
		return [token];
	}

	const previousToken = tokens[tokens.length - 1];

	if (previousToken.endsWith('\\')) {
		return [...tokens.slice(0, -1), `${previousToken.slice(0, -1)} ${token}`];
	}

	return [...tokens, token];
};

// Handle `execa.command()`
const parseCommand = command => {
	return command
		.trim()
		.split(SPACES_REGEXP)
		.reduce(handleEscaping, []);
};

module.exports = {
	joinCommand,
	parseCommand
};
