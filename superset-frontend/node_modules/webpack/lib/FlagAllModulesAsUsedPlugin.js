/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/

"use strict";

/** @typedef {import("./Compiler")} Compiler */

class FlagAllModulesAsUsedPlugin {
	constructor(explanation) {
		this.explanation = explanation;
	}

	/**
	 * @param {Compiler} compiler webpack compiler
	 * @returns {void}
	 */
	apply(compiler) {
		compiler.hooks.compilation.tap(
			"FlagAllModulesAsUsedPlugin",
			compilation => {
				compilation.hooks.optimizeDependencies.tap(
					"FlagAllModulesAsUsedPlugin",
					modules => {
						for (const module of modules) {
							module.used = true;
							module.usedExports = true;
							module.addReason(null, null, this.explanation);
						}
					}
				);
			}
		);
	}
}

module.exports = FlagAllModulesAsUsedPlugin;
