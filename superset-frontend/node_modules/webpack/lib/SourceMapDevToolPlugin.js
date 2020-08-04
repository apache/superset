/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const path = require("path");
const { ConcatSource, RawSource } = require("webpack-sources");
const ModuleFilenameHelpers = require("./ModuleFilenameHelpers");
const SourceMapDevToolModuleOptionsPlugin = require("./SourceMapDevToolModuleOptionsPlugin");
const createHash = require("./util/createHash");
const { absolutify } = require("./util/identifier");

const validateOptions = require("schema-utils");
const schema = require("../schemas/plugins/SourceMapDevToolPlugin.json");

/** @typedef {import("../declarations/plugins/SourceMapDevToolPlugin").SourceMapDevToolPluginOptions} SourceMapDevToolPluginOptions */
/** @typedef {import("./Chunk")} Chunk */
/** @typedef {import("webpack-sources").Source} Source */
/** @typedef {import("source-map").RawSourceMap} SourceMap */
/** @typedef {import("./Module")} Module */
/** @typedef {import("./Compilation")} Compilation */
/** @typedef {import("./Compiler")} Compiler */
/** @typedef {import("./Compilation")} SourceMapDefinition */

/**
 * @typedef {object} SourceMapTask
 * @property {Source} asset
 * @property {Array<string | Module>} [modules]
 * @property {string} source
 * @property {string} file
 * @property {SourceMap} sourceMap
 * @property {Chunk} chunk
 */

/**
 * @param {string} name file path
 * @returns {string} file name
 */
const basename = name => {
	if (!name.includes("/")) return name;
	return name.substr(name.lastIndexOf("/") + 1);
};

/**
 * @type {WeakMap<Source, {file: string, assets: {[k: string]: ConcatSource | RawSource}}>}
 */
const assetsCache = new WeakMap();

/**
 * Creating {@link SourceMapTask} for given file
 * @param {string} file current compiled file
 * @param {Source} asset the asset
 * @param {Chunk} chunk related chunk
 * @param {SourceMapDevToolPluginOptions} options source map options
 * @param {Compilation} compilation compilation instance
 * @returns {SourceMapTask | undefined} created task instance or `undefined`
 */
const getTaskForFile = (file, asset, chunk, options, compilation) => {
	let source, sourceMap;
	/**
	 * Check if asset can build source map
	 */
	if (asset.sourceAndMap) {
		const sourceAndMap = asset.sourceAndMap(options);
		sourceMap = sourceAndMap.map;
		source = sourceAndMap.source;
	} else {
		sourceMap = asset.map(options);
		source = asset.source();
	}
	if (!sourceMap || typeof source !== "string") return;
	const context = compilation.options.context;
	const modules = sourceMap.sources.map(source => {
		if (source.startsWith("webpack://")) {
			source = absolutify(context, source.slice(10));
		}
		const module = compilation.findModule(source);
		return module || source;
	});

	return {
		chunk,
		file,
		asset,
		source,
		sourceMap,
		modules
	};
};

class SourceMapDevToolPlugin {
	/**
	 * @param {SourceMapDevToolPluginOptions} [options] options object
	 * @throws {Error} throws error, if got more than 1 arguments
	 */
	constructor(options) {
		if (arguments.length > 1) {
			throw new Error(
				"SourceMapDevToolPlugin only takes one argument (pass an options object)"
			);
		}

		if (!options) options = {};

		validateOptions(schema, options, "SourceMap DevTool Plugin");

		/** @type {string | false} */
		this.sourceMapFilename = options.filename;
		/** @type {string | false} */
		this.sourceMappingURLComment =
			options.append === false
				? false
				: options.append || "\n//# sourceMappingURL=[url]";
		/** @type {string | Function} */
		this.moduleFilenameTemplate =
			options.moduleFilenameTemplate || "webpack://[namespace]/[resourcePath]";
		/** @type {string | Function} */
		this.fallbackModuleFilenameTemplate =
			options.fallbackModuleFilenameTemplate ||
			"webpack://[namespace]/[resourcePath]?[hash]";
		/** @type {string} */
		this.namespace = options.namespace || "";
		/** @type {SourceMapDevToolPluginOptions} */
		this.options = options;
	}

	/**
	 * Apply compiler
	 * @param {Compiler} compiler compiler instance
	 * @returns {void}
	 */
	apply(compiler) {
		const sourceMapFilename = this.sourceMapFilename;
		const sourceMappingURLComment = this.sourceMappingURLComment;
		const moduleFilenameTemplate = this.moduleFilenameTemplate;
		const namespace = this.namespace;
		const fallbackModuleFilenameTemplate = this.fallbackModuleFilenameTemplate;
		const requestShortener = compiler.requestShortener;
		const options = this.options;
		options.test = options.test || /\.(m?js|css)($|\?)/i;

		const matchObject = ModuleFilenameHelpers.matchObject.bind(
			undefined,
			options
		);

		compiler.hooks.compilation.tap("SourceMapDevToolPlugin", compilation => {
			new SourceMapDevToolModuleOptionsPlugin(options).apply(compilation);

			compilation.hooks.afterOptimizeChunkAssets.tap(
				/** @type {TODO} */
				({ name: "SourceMapDevToolPlugin", context: true }),
				/**
				 * @param {object} context hook context
				 * @param {Array<Chunk>} chunks resulted chunks
				 * @throws {Error} throws error, if `sourceMapFilename === false && sourceMappingURLComment === false`
				 * @returns {void}
				 */
				(context, chunks) => {
					/** @type {Map<string | Module, string>} */
					const moduleToSourceNameMapping = new Map();
					/**
					 * @type {Function}
					 * @returns {void}
					 */
					const reportProgress =
						context && context.reportProgress
							? context.reportProgress
							: () => {};

					const files = [];
					for (const chunk of chunks) {
						for (const file of chunk.files) {
							if (matchObject(file)) {
								files.push({
									file,
									chunk
								});
							}
						}
					}

					reportProgress(0.0);
					const tasks = [];
					files.forEach(({ file, chunk }, idx) => {
						const asset = compilation.getAsset(file).source;
						const cache = assetsCache.get(asset);
						/**
						 * If presented in cache, reassigns assets. Cache assets already have source maps.
						 */
						if (cache && cache.file === file) {
							for (const cachedFile in cache.assets) {
								if (cachedFile === file) {
									compilation.updateAsset(cachedFile, cache.assets[cachedFile]);
								} else {
									compilation.emitAsset(cachedFile, cache.assets[cachedFile], {
										development: true
									});
								}
								/**
								 * Add file to chunk, if not presented there
								 */
								if (cachedFile !== file) chunk.files.push(cachedFile);
							}
							return;
						}

						reportProgress(
							(0.5 * idx) / files.length,
							file,
							"generate SourceMap"
						);
						/** @type {SourceMapTask | undefined} */
						const task = getTaskForFile(
							file,
							asset,
							chunk,
							options,
							compilation
						);

						if (task) {
							const modules = task.modules;

							for (let idx = 0; idx < modules.length; idx++) {
								const module = modules[idx];
								if (!moduleToSourceNameMapping.get(module)) {
									moduleToSourceNameMapping.set(
										module,
										ModuleFilenameHelpers.createFilename(
											module,
											{
												moduleFilenameTemplate: moduleFilenameTemplate,
												namespace: namespace
											},
											requestShortener
										)
									);
								}
							}

							tasks.push(task);
						}
					});

					reportProgress(0.5, "resolve sources");
					/** @type {Set<string>} */
					const usedNamesSet = new Set(moduleToSourceNameMapping.values());
					/** @type {Set<string>} */
					const conflictDetectionSet = new Set();

					/**
					 * all modules in defined order (longest identifier first)
					 * @type {Array<string | Module>}
					 */
					const allModules = Array.from(moduleToSourceNameMapping.keys()).sort(
						(a, b) => {
							const ai = typeof a === "string" ? a : a.identifier();
							const bi = typeof b === "string" ? b : b.identifier();
							return ai.length - bi.length;
						}
					);

					// find modules with conflicting source names
					for (let idx = 0; idx < allModules.length; idx++) {
						const module = allModules[idx];
						let sourceName = moduleToSourceNameMapping.get(module);
						let hasName = conflictDetectionSet.has(sourceName);
						if (!hasName) {
							conflictDetectionSet.add(sourceName);
							continue;
						}

						// try the fallback name first
						sourceName = ModuleFilenameHelpers.createFilename(
							module,
							{
								moduleFilenameTemplate: fallbackModuleFilenameTemplate,
								namespace: namespace
							},
							requestShortener
						);
						hasName = usedNamesSet.has(sourceName);
						if (!hasName) {
							moduleToSourceNameMapping.set(module, sourceName);
							usedNamesSet.add(sourceName);
							continue;
						}

						// elsewise just append stars until we have a valid name
						while (hasName) {
							sourceName += "*";
							hasName = usedNamesSet.has(sourceName);
						}
						moduleToSourceNameMapping.set(module, sourceName);
						usedNamesSet.add(sourceName);
					}
					tasks.forEach((task, index) => {
						reportProgress(
							0.5 + (0.5 * index) / tasks.length,
							task.file,
							"attach SourceMap"
						);
						const assets = Object.create(null);
						const chunk = task.chunk;
						const file = task.file;
						const asset = task.asset;
						const sourceMap = task.sourceMap;
						const source = task.source;
						const modules = task.modules;
						const moduleFilenames = modules.map(m =>
							moduleToSourceNameMapping.get(m)
						);
						sourceMap.sources = moduleFilenames;
						if (options.noSources) {
							sourceMap.sourcesContent = undefined;
						}
						sourceMap.sourceRoot = options.sourceRoot || "";
						sourceMap.file = file;
						assetsCache.set(asset, { file, assets });
						/** @type {string | false} */
						let currentSourceMappingURLComment = sourceMappingURLComment;
						if (
							currentSourceMappingURLComment !== false &&
							/\.css($|\?)/i.test(file)
						) {
							currentSourceMappingURLComment = currentSourceMappingURLComment.replace(
								/^\n\/\/(.*)$/,
								"\n/*$1*/"
							);
						}
						const sourceMapString = JSON.stringify(sourceMap);
						if (sourceMapFilename) {
							let filename = file;
							let query = "";
							const idx = filename.indexOf("?");
							if (idx >= 0) {
								query = filename.substr(idx);
								filename = filename.substr(0, idx);
							}
							const pathParams = {
								chunk,
								filename: options.fileContext
									? path.relative(options.fileContext, filename)
									: filename,
								query,
								basename: basename(filename),
								contentHash: createHash("md4")
									.update(sourceMapString)
									.digest("hex")
							};
							let sourceMapFile = compilation.getPath(
								sourceMapFilename,
								pathParams
							);
							const sourceMapUrl = options.publicPath
								? options.publicPath + sourceMapFile.replace(/\\/g, "/")
								: path
										.relative(path.dirname(file), sourceMapFile)
										.replace(/\\/g, "/");
							/**
							 * Add source map url to compilation asset, if {@link currentSourceMappingURLComment} presented
							 */
							if (currentSourceMappingURLComment !== false) {
								const asset = new ConcatSource(
									new RawSource(source),
									compilation.getPath(
										currentSourceMappingURLComment,
										Object.assign({ url: sourceMapUrl }, pathParams)
									)
								);
								assets[file] = asset;
								compilation.updateAsset(file, asset);
							}
							/**
							 * Add source map file to compilation assets and chunk files
							 */
							const asset = new RawSource(sourceMapString);
							assets[sourceMapFile] = asset;
							compilation.emitAsset(sourceMapFile, asset, {
								development: true
							});
							chunk.files.push(sourceMapFile);
						} else {
							if (currentSourceMappingURLComment === false) {
								throw new Error(
									"SourceMapDevToolPlugin: append can't be false when no filename is provided"
								);
							}
							/**
							 * Add source map as data url to asset
							 */
							const asset = new ConcatSource(
								new RawSource(source),
								currentSourceMappingURLComment
									.replace(/\[map\]/g, () => sourceMapString)
									.replace(
										/\[url\]/g,
										() =>
											`data:application/json;charset=utf-8;base64,${Buffer.from(
												sourceMapString,
												"utf-8"
											).toString("base64")}`
									)
							);
							assets[file] = asset;
							compilation.updateAsset(file, asset);
						}
					});
					reportProgress(1.0);
				}
			);
		});
	}
}

module.exports = SourceMapDevToolPlugin;
