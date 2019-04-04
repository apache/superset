"use strict";

module.exports = function prepareOptions(options, argv) {
	argv = argv || {};
	options = handleExport(options);

	return Array.isArray(options)
		? options.map(_options => handleFunction(_options, argv))
		: handleFunction(options, argv);
};

function handleExport(options) {
	const isES6DefaultExported =
		typeof options === "object" &&
		options !== null &&
		typeof options.default !== "undefined";

	return isES6DefaultExported ? options.default : options;
}

function handleFunction(options, argv) {
	if (typeof options === "function") {
		options = options(argv.env, argv);
	}
	return options;
}
