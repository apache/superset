/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Sean Larkin @thelarkinn
*/
"use strict";
const EntrypointsOverSizeLimitWarning = require("./EntrypointsOverSizeLimitWarning");
const AssetsOverSizeLimitWarning = require("./AssetsOverSizeLimitWarning");
const NoAsyncChunksWarning = require("./NoAsyncChunksWarning");

/** @typedef {import("../Compiler")} Compiler */
/** @typedef {import("../Entrypoint")} Entrypoint */

module.exports = class SizeLimitsPlugin {
	constructor(options) {
		this.hints = options.hints;
		this.maxAssetSize = options.maxAssetSize;
		this.maxEntrypointSize = options.maxEntrypointSize;
		this.assetFilter = options.assetFilter;
	}

	/**
	 * @param {Compiler} compiler webpack compiler
	 * @returns {void}
	 */
	apply(compiler) {
		const entrypointSizeLimit = this.maxEntrypointSize;
		const assetSizeLimit = this.maxAssetSize;
		const hints = this.hints;
		const assetFilter =
			this.assetFilter || ((name, source, info) => !info.development);

		compiler.hooks.afterEmit.tap("SizeLimitsPlugin", compilation => {
			const warnings = [];

			/**
			 * @param {Entrypoint} entrypoint an entrypoint
			 * @returns {number} the size of the entrypoint
			 */
			const getEntrypointSize = entrypoint =>
				entrypoint.getFiles().reduce((currentSize, file) => {
					const asset = compilation.getAsset(file);
					if (
						asset &&
						assetFilter(asset.name, asset.source, asset.info) &&
						asset.source
					) {
						return currentSize + (asset.info.size || asset.source.size());
					}

					return currentSize;
				}, 0);

			const assetsOverSizeLimit = [];
			for (const { name, source, info } of compilation.getAssets()) {
				if (!assetFilter(name, source, info) || !source) {
					continue;
				}

				const size = info.size || source.size();
				if (size > assetSizeLimit) {
					assetsOverSizeLimit.push({
						name,
						size
					});
					/** @type {any} */ (source).isOverSizeLimit = true;
				}
			}

			const fileFilter = name => {
				const asset = compilation.getAsset(name);
				return asset && assetFilter(asset.name, asset.source, asset.info);
			};

			const entrypointsOverLimit = [];
			for (const [name, entry] of compilation.entrypoints) {
				const size = getEntrypointSize(entry);

				if (size > entrypointSizeLimit) {
					entrypointsOverLimit.push({
						name: name,
						size: size,
						files: entry.getFiles().filter(fileFilter)
					});
					/** @type {any} */ (entry).isOverSizeLimit = true;
				}
			}

			if (hints) {
				// 1. Individual Chunk: Size < 250kb
				// 2. Collective Initial Chunks [entrypoint] (Each Set?): Size < 250kb
				// 3. No Async Chunks
				// if !1, then 2, if !2 return
				if (assetsOverSizeLimit.length > 0) {
					warnings.push(
						new AssetsOverSizeLimitWarning(assetsOverSizeLimit, assetSizeLimit)
					);
				}
				if (entrypointsOverLimit.length > 0) {
					warnings.push(
						new EntrypointsOverSizeLimitWarning(
							entrypointsOverLimit,
							entrypointSizeLimit
						)
					);
				}

				if (warnings.length > 0) {
					const hasAsyncChunks =
						compilation.chunks.filter(chunk => !chunk.canBeInitial()).length >
						0;

					if (!hasAsyncChunks) {
						warnings.push(new NoAsyncChunksWarning());
					}

					if (hints === "error") {
						compilation.errors.push(...warnings);
					} else {
						compilation.warnings.push(...warnings);
					}
				}
			}
		});
	}
};
