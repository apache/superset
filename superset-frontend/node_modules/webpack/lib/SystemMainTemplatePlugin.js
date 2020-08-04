/*
 MIT License http://www.opensource.org/licenses/mit-license.php
 Author Joel Denning @joeldenning
 */

"use strict";

const { ConcatSource } = require("webpack-sources");
const Template = require("./Template");

/** @typedef {import("./Compilation")} Compilation */

/**
 * @typedef {Object} SystemMainTemplatePluginOptions
 * @param {string=} name the library name
 */

class SystemMainTemplatePlugin {
	/**
	 * @param {SystemMainTemplatePluginOptions} options the plugin options
	 */
	constructor(options) {
		this.name = options.name;
	}

	/**
	 * @param {Compilation} compilation the compilation instance
	 * @returns {void}
	 */
	apply(compilation) {
		const { mainTemplate, chunkTemplate } = compilation;

		const onRenderWithEntry = (source, chunk, hash) => {
			const externals = chunk.getModules().filter(m => m.external);

			// The name this bundle should be registered as with System
			const name = this.name
				? `${JSON.stringify(
						mainTemplate.getAssetPath(this.name, { hash, chunk })
				  )}, `
				: "";

			// The array of dependencies that are external to webpack and will be provided by System
			const systemDependencies = JSON.stringify(
				externals.map(m =>
					typeof m.request === "object" ? m.request.amd : m.request
				)
			);

			// The name of the variable provided by System for exporting
			const dynamicExport = "__WEBPACK_DYNAMIC_EXPORT__";

			// An array of the internal variable names for the webpack externals
			const externalWebpackNames = externals.map(
				m => `__WEBPACK_EXTERNAL_MODULE_${Template.toIdentifier(`${m.id}`)}__`
			);

			// Declaring variables for the internal variable names for the webpack externals
			const externalVarDeclarations =
				externalWebpackNames.length > 0
					? `var ${externalWebpackNames.join(", ")};`
					: "";

			// The system.register format requires an array of setter functions for externals.
			const setters =
				externalWebpackNames.length === 0
					? ""
					: Template.asString([
							"setters: [",
							Template.indent(
								externalWebpackNames
									.map(external =>
										Template.asString([
											"function(module) {",
											Template.indent(`${external} = module;`),
											"}"
										])
									)
									.join(",\n")
							),
							"],"
					  ]);

			return new ConcatSource(
				Template.asString([
					`System.register(${name}${systemDependencies}, function(${dynamicExport}) {`,
					Template.indent([
						externalVarDeclarations,
						"return {",
						Template.indent([
							setters,
							"execute: function() {",
							Template.indent(`${dynamicExport}(`)
						])
					])
				]) + "\n",
				source,
				"\n" +
					Template.asString([
						Template.indent([
							Template.indent([Template.indent([");"]), "}"]),
							"};"
						]),
						"})"
					])
			);
		};

		for (const template of [mainTemplate, chunkTemplate]) {
			template.hooks.renderWithEntry.tap(
				"SystemMainTemplatePlugin",
				onRenderWithEntry
			);
		}

		mainTemplate.hooks.globalHashPaths.tap(
			"SystemMainTemplatePlugin",
			paths => {
				if (this.name) {
					paths.push(this.name);
				}
				return paths;
			}
		);

		mainTemplate.hooks.hash.tap("SystemMainTemplatePlugin", hash => {
			hash.update("exports system");
			if (this.name) {
				hash.update(this.name);
			}
		});
	}
}

module.exports = SystemMainTemplatePlugin;
