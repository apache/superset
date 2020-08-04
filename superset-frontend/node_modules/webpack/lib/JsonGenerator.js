/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const { ConcatSource, RawSource } = require("webpack-sources");

const stringifySafe = data => {
	const stringified = JSON.stringify(data);
	if (!stringified) {
		return undefined; // Invalid JSON
	}

	return stringified.replace(/\u2028|\u2029/g, str =>
		str === "\u2029" ? "\\u2029" : "\\u2028"
	); // invalid in JavaScript but valid JSON
};

class JsonGenerator {
	generate(module, dependencyTemplates, runtimeTemplate) {
		const source = new ConcatSource();
		const data = module.buildInfo.jsonData;
		if (data === undefined) {
			return new RawSource(
				runtimeTemplate.missingModuleStatement({
					request: module.rawRequest
				})
			);
		}
		let finalJson;
		if (
			Array.isArray(module.buildMeta.providedExports) &&
			!module.isUsed("default")
		) {
			// Only some exports are used: We can optimize here, by only generating a part of the JSON
			const reducedJson = {};
			for (const exportName of module.buildMeta.providedExports) {
				if (exportName === "default") continue;
				const used = module.isUsed(exportName);
				if (used) {
					reducedJson[used] = data[exportName];
				}
			}
			finalJson = reducedJson;
		} else {
			finalJson = data;
		}
		// Use JSON because JSON.parse() is much faster than JavaScript evaluation
		const jsonSource = JSON.stringify(stringifySafe(finalJson));
		const jsonExpr = `JSON.parse(${jsonSource})`;
		source.add(`${module.moduleArgument}.exports = ${jsonExpr};`);
		return source;
	}
}

module.exports = JsonGenerator;
