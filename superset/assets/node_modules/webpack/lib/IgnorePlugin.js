/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const validateOptions = require("schema-utils");
const schema = require("../schemas/plugins/IgnorePlugin.json");

/** @typedef {import("../declarations/plugins/IgnorePlugin").IgnorePluginOptions} IgnorePluginOptions */
/** @typedef {import("./Compiler")} Compiler */

class IgnorePlugin {
	/**
	 * @param {IgnorePluginOptions} options IgnorePlugin options
	 */
	constructor(options) {
		// TODO webpack 5 remove this compat-layer
		if (arguments.length > 1 || options instanceof RegExp) {
			options = {
				resourceRegExp: arguments[0],
				contextRegExp: arguments[1]
			};
		}

		validateOptions(schema, options, "IgnorePlugin");
		this.options = options;

		/** @private @type {Function} */
		this.checkIgnore = this.checkIgnore.bind(this);
	}

	/**
	 * @param {string} resource resource
	 * @returns {boolean} returns true if a "resourceRegExp" exists
	 * and the resource given matches the regexp.
	 */
	checkResource(resource) {
		if ("checkResource" in this.options && this.options.checkResource) {
			return this.options.checkResource(resource);
		}
		if ("resourceRegExp" in this.options && this.options.resourceRegExp) {
			return this.options.resourceRegExp.test(resource);
		}
		return false;
	}

	/**
	 * @param {string} context context
	 * @returns {boolean} returns true if "contextRegExp" does not exist
	 * or if context matches the given regexp.
	 */
	checkContext(context) {
		if ("checkContext" in this.options && this.options.checkContext) {
			return this.options.checkContext(context);
		}
		if ("contextRegExp" in this.options && this.options.contextRegExp) {
			return this.options.contextRegExp.test(context);
		}
		return true;
	}

	/**
	 * Note that if "contextRegExp" is given, both the "resourceRegExp"
	 * and "contextRegExp" have to match.
	 *
	 * @param {TODO} result result
	 * @returns {boolean} returns true if result should be ignored
	 */
	checkResult(result) {
		if (!result) {
			return true;
		}
		return (
			this.checkResource(result.request) && this.checkContext(result.context)
		);
	}

	/**
	 * @param {TODO} result result
	 * @returns {TODO|null} returns result or null if result should be ignored
	 */
	checkIgnore(result) {
		// check if result is ignored
		if (this.checkResult(result)) {
			return null;
		}
		return result;
	}

	/**
	 * @param {Compiler} compiler Webpack Compiler
	 * @returns {void}
	 */
	apply(compiler) {
		compiler.hooks.normalModuleFactory.tap("IgnorePlugin", nmf => {
			nmf.hooks.beforeResolve.tap("IgnorePlugin", this.checkIgnore);
		});
		compiler.hooks.contextModuleFactory.tap("IgnorePlugin", cmf => {
			cmf.hooks.beforeResolve.tap("IgnorePlugin", this.checkIgnore);
		});
	}
}

module.exports = IgnorePlugin;
