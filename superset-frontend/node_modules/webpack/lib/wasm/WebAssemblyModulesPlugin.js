/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const Generator = require("../Generator");
const WebAssemblyExportImportedDependency = require("../dependencies/WebAssemblyExportImportedDependency");
const WebAssemblyImportDependency = require("../dependencies/WebAssemblyImportDependency");
const WebAssemblyInInitialChunkError = require("./WebAssemblyInInitialChunkError");

/** @typedef {import("../Compiler")} Compiler */

let WebAssemblyGenerator;
let WebAssemblyJavascriptGenerator;
let WebAssemblyParser;

class WebAssemblyModulesPlugin {
	constructor(options) {
		this.options = options;
	}

	/**
	 * @param {Compiler} compiler compiler
	 * @returns {void}
	 */
	apply(compiler) {
		compiler.hooks.compilation.tap(
			"WebAssemblyModulesPlugin",
			(compilation, { normalModuleFactory }) => {
				compilation.dependencyFactories.set(
					WebAssemblyImportDependency,
					normalModuleFactory
				);

				compilation.dependencyFactories.set(
					WebAssemblyExportImportedDependency,
					normalModuleFactory
				);

				normalModuleFactory.hooks.createParser
					.for("webassembly/experimental")
					.tap("WebAssemblyModulesPlugin", () => {
						if (WebAssemblyParser === undefined) {
							WebAssemblyParser = require("./WebAssemblyParser");
						}
						return new WebAssemblyParser();
					});

				normalModuleFactory.hooks.createGenerator
					.for("webassembly/experimental")
					.tap("WebAssemblyModulesPlugin", () => {
						if (WebAssemblyGenerator === undefined) {
							WebAssemblyGenerator = require("./WebAssemblyGenerator");
						}
						if (WebAssemblyJavascriptGenerator === undefined) {
							WebAssemblyJavascriptGenerator = require("./WebAssemblyJavascriptGenerator");
						}
						return Generator.byType({
							javascript: new WebAssemblyJavascriptGenerator(),
							webassembly: new WebAssemblyGenerator(this.options)
						});
					});

				compilation.chunkTemplate.hooks.renderManifest.tap(
					"WebAssemblyModulesPlugin",
					(result, options) => {
						const chunk = options.chunk;
						const outputOptions = options.outputOptions;
						const moduleTemplates = options.moduleTemplates;
						const dependencyTemplates = options.dependencyTemplates;

						for (const module of chunk.modulesIterable) {
							if (module.type && module.type.startsWith("webassembly")) {
								const filenameTemplate =
									outputOptions.webassemblyModuleFilename;

								result.push({
									render: () =>
										this.renderWebAssembly(
											module,
											moduleTemplates.webassembly,
											dependencyTemplates
										),
									filenameTemplate,
									pathOptions: {
										module
									},
									identifier: `webassemblyModule${module.id}`,
									hash: module.hash
								});
							}
						}

						return result;
					}
				);

				compilation.hooks.afterChunks.tap("WebAssemblyModulesPlugin", () => {
					const initialWasmModules = new Set();
					for (const chunk of compilation.chunks) {
						if (chunk.canBeInitial()) {
							for (const module of chunk.modulesIterable) {
								if (module.type.startsWith("webassembly")) {
									initialWasmModules.add(module);
								}
							}
						}
					}
					for (const module of initialWasmModules) {
						compilation.errors.push(
							new WebAssemblyInInitialChunkError(
								module,
								compilation.requestShortener
							)
						);
					}
				});
			}
		);
	}

	renderWebAssembly(module, moduleTemplate, dependencyTemplates) {
		return moduleTemplate.render(module, dependencyTemplates, {});
	}
}

module.exports = WebAssemblyModulesPlugin;
