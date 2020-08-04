/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const validateOptions = require("schema-utils");
const schema = require("../schemas/plugins/ProgressPlugin.json");

/** @typedef {import("../declarations/plugins/ProgressPlugin").ProgressPluginArgument} ProgressPluginArgument */
/** @typedef {import("../declarations/plugins/ProgressPlugin").ProgressPluginOptions} ProgressPluginOptions */

const createDefaultHandler = (profile, logger) => {
	let lastState;
	let lastStateTime;

	const defaultHandler = (percentage, msg, ...args) => {
		logger.status(`${Math.floor(percentage * 100)}%`, msg, ...args);
		if (profile) {
			let state = msg;
			state = state.replace(/^\d+\/\d+\s+/, "");
			if (percentage === 0) {
				lastState = null;
				lastStateTime = Date.now();
			} else if (state !== lastState || percentage === 1) {
				const now = Date.now();
				if (lastState) {
					const diff = now - lastStateTime;
					const stateMsg = `${diff}ms ${lastState}`;
					if (diff > 1000) {
						logger.warn(stateMsg);
					} else if (diff > 10) {
						logger.info(stateMsg);
					} else if (diff > 0) {
						logger.log(stateMsg);
					} else {
						logger.debug(stateMsg);
					}
				}
				lastState = state;
				lastStateTime = now;
			}
		}
		if (percentage === 1) logger.status();
	};

	return defaultHandler;
};

class ProgressPlugin {
	/**
	 * @param {ProgressPluginArgument} options options
	 */
	constructor(options) {
		if (typeof options === "function") {
			options = {
				handler: options
			};
		}

		options = options || {};
		validateOptions(schema, options, "Progress Plugin");
		options = Object.assign({}, ProgressPlugin.defaultOptions, options);

		this.profile = options.profile;
		this.handler = options.handler;
		this.modulesCount = options.modulesCount;
		this.showEntries = options.entries;
		this.showModules = options.modules;
		this.showActiveModules = options.activeModules;
	}

	apply(compiler) {
		const { modulesCount } = this;
		const handler =
			this.handler ||
			createDefaultHandler(
				this.profile,
				compiler.getInfrastructureLogger("webpack.Progress")
			);
		const showEntries = this.showEntries;
		const showModules = this.showModules;
		const showActiveModules = this.showActiveModules;
		if (compiler.compilers) {
			const states = new Array(compiler.compilers.length);
			compiler.compilers.forEach((compiler, idx) => {
				new ProgressPlugin((p, msg, ...args) => {
					states[idx] = [p, msg, ...args];
					handler(
						states
							.map(state => (state && state[0]) || 0)
							.reduce((a, b) => a + b) / states.length,
						`[${idx}] ${msg}`,
						...args
					);
				}).apply(compiler);
			});
		} else {
			let lastModulesCount = 0;
			let lastEntriesCount = 0;
			let moduleCount = modulesCount;
			let entriesCount = 1;
			let doneModules = 0;
			let doneEntries = 0;
			const activeModules = new Set();
			let lastActiveModule = "";

			const update = () => {
				const percentByModules =
					doneModules / Math.max(lastModulesCount, moduleCount);
				const percentByEntries =
					doneEntries / Math.max(lastEntriesCount, entriesCount);

				const items = [
					0.1 + Math.max(percentByModules, percentByEntries) * 0.6,
					"building"
				];
				if (showEntries) {
					items.push(`${doneEntries}/${entriesCount} entries`);
				}
				if (showModules) {
					items.push(`${doneModules}/${moduleCount} modules`);
				}
				if (showActiveModules) {
					items.push(`${activeModules.size} active`);
					items.push(lastActiveModule);
				}
				handler(...items);
			};

			const moduleAdd = module => {
				moduleCount++;
				if (showActiveModules) {
					const ident = module.identifier();
					if (ident) {
						activeModules.add(ident);
						lastActiveModule = ident;
					}
				}
				update();
			};

			const entryAdd = (entry, name) => {
				entriesCount++;
				update();
			};

			const moduleDone = module => {
				doneModules++;
				if (showActiveModules) {
					const ident = module.identifier();
					if (ident) {
						activeModules.delete(ident);
						if (lastActiveModule === ident) {
							lastActiveModule = "";
							for (const m of activeModules) {
								lastActiveModule = m;
							}
						}
					}
				}
				update();
			};

			const entryDone = (entry, name) => {
				doneEntries++;
				update();
			};

			compiler.hooks.compilation.tap("ProgressPlugin", compilation => {
				if (compilation.compiler.isChild()) return;
				lastModulesCount = moduleCount;
				lastEntriesCount = entriesCount;
				moduleCount = entriesCount = 0;
				doneModules = doneEntries = 0;
				handler(0, "compiling");

				compilation.hooks.buildModule.tap("ProgressPlugin", moduleAdd);
				compilation.hooks.failedModule.tap("ProgressPlugin", moduleDone);
				compilation.hooks.succeedModule.tap("ProgressPlugin", moduleDone);

				compilation.hooks.addEntry.tap("ProgressPlugin", entryAdd);
				compilation.hooks.failedEntry.tap("ProgressPlugin", entryDone);
				compilation.hooks.succeedEntry.tap("ProgressPlugin", entryDone);

				const hooks = {
					finishModules: "finish module graph",
					seal: "sealing",
					beforeChunks: "chunk graph",
					afterChunks: "after chunk graph",
					optimizeDependenciesBasic: "basic dependencies optimization",
					optimizeDependencies: "dependencies optimization",
					optimizeDependenciesAdvanced: "advanced dependencies optimization",
					afterOptimizeDependencies: "after dependencies optimization",
					optimize: "optimizing",
					optimizeModulesBasic: "basic module optimization",
					optimizeModules: "module optimization",
					optimizeModulesAdvanced: "advanced module optimization",
					afterOptimizeModules: "after module optimization",
					optimizeChunksBasic: "basic chunk optimization",
					optimizeChunks: "chunk optimization",
					optimizeChunksAdvanced: "advanced chunk optimization",
					afterOptimizeChunks: "after chunk optimization",
					optimizeTree: "module and chunk tree optimization",
					afterOptimizeTree: "after module and chunk tree optimization",
					optimizeChunkModulesBasic: "basic chunk modules optimization",
					optimizeChunkModules: "chunk modules optimization",
					optimizeChunkModulesAdvanced: "advanced chunk modules optimization",
					afterOptimizeChunkModules: "after chunk modules optimization",
					reviveModules: "module reviving",
					optimizeModuleOrder: "module order optimization",
					advancedOptimizeModuleOrder: "advanced module order optimization",
					beforeModuleIds: "before module ids",
					moduleIds: "module ids",
					optimizeModuleIds: "module id optimization",
					afterOptimizeModuleIds: "module id optimization",
					reviveChunks: "chunk reviving",
					optimizeChunkOrder: "chunk order optimization",
					beforeChunkIds: "before chunk ids",
					optimizeChunkIds: "chunk id optimization",
					afterOptimizeChunkIds: "after chunk id optimization",
					recordModules: "record modules",
					recordChunks: "record chunks",
					beforeHash: "hashing",
					afterHash: "after hashing",
					recordHash: "record hash",
					beforeModuleAssets: "module assets processing",
					beforeChunkAssets: "chunk assets processing",
					additionalChunkAssets: "additional chunk assets processing",
					record: "recording",
					additionalAssets: "additional asset processing",
					optimizeChunkAssets: "chunk asset optimization",
					afterOptimizeChunkAssets: "after chunk asset optimization",
					optimizeAssets: "asset optimization",
					afterOptimizeAssets: "after asset optimization",
					afterSeal: "after seal"
				};
				const numberOfHooks = Object.keys(hooks).length;
				Object.keys(hooks).forEach((name, idx) => {
					const title = hooks[name];
					const percentage = (idx / numberOfHooks) * 0.25 + 0.7;
					compilation.hooks[name].intercept({
						name: "ProgressPlugin",
						context: true,
						call: () => {
							handler(percentage, title);
						},
						tap: (context, tap) => {
							if (context) {
								// p is percentage from 0 to 1
								// args is any number of messages in a hierarchical matter
								context.reportProgress = (p, ...args) => {
									handler(percentage, title, tap.name, ...args);
								};
							}
							handler(percentage, title, tap.name);
						}
					});
				});
			});
			compiler.hooks.emit.intercept({
				name: "ProgressPlugin",
				context: true,
				call: () => {
					handler(0.95, "emitting");
				},
				tap: (context, tap) => {
					if (context) {
						context.reportProgress = (p, ...args) => {
							handler(0.95, "emitting", tap.name, ...args);
						};
					}
					handler(0.95, "emitting", tap.name);
				}
			});
			compiler.hooks.afterEmit.intercept({
				name: "ProgressPlugin",
				context: true,
				call: () => {
					handler(0.98, "after emitting");
				},
				tap: (context, tap) => {
					if (context) {
						context.reportProgress = (p, ...args) => {
							handler(0.98, "after emitting", tap.name, ...args);
						};
					}
					handler(0.98, "after emitting", tap.name);
				}
			});
			compiler.hooks.done.tap("ProgressPlugin", () => {
				handler(1, "");
			});
		}
	}
}

ProgressPlugin.defaultOptions = {
	profile: false,
	modulesCount: 500,
	modules: true,
	activeModules: true,
	// TODO webpack 5 default this to true
	entries: false
};

module.exports = ProgressPlugin;
