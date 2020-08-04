"use strict";

const errorMessage = (schema, data, message) => ({
	keyword: "absolutePath",
	params: { absolutePath: data },
	message: message,
	parentSchema: schema
});

const getErrorFor = (shouldBeAbsolute, data, schema) => {
	const message = shouldBeAbsolute
		? `The provided value ${JSON.stringify(data)} is not an absolute path!`
		: `A relative path is expected. However, the provided value ${JSON.stringify(
				data
		  )} is an absolute path!`;

	return errorMessage(schema, data, message);
};

module.exports = ajv =>
	ajv.addKeyword("absolutePath", {
		errors: true,
		type: "string",
		compile(expected, schema) {
			function callback(data) {
				let passes = true;
				const isExclamationMarkPresent = data.includes("!");

				if (isExclamationMarkPresent) {
					callback.errors = [
						errorMessage(
							schema,
							data,
							`The provided value ${JSON.stringify(
								data
							)} contains exclamation mark (!) which is not allowed because it's reserved for loader syntax.`
						)
					];
					passes = false;
				}
				// ?:[A-Za-z]:\\ - Windows absolute path
				// \\\\ - Windows network absolute path
				// \/ - Unix-like OS absolute path
				const isCorrectAbsolutePath =
					expected === /^(?:[A-Za-z]:\\|\\\\|\/)/.test(data);
				if (!isCorrectAbsolutePath) {
					callback.errors = [getErrorFor(expected, data, schema)];
					passes = false;
				}

				return passes;
			}
			callback.errors = [];

			return callback;
		}
	});
