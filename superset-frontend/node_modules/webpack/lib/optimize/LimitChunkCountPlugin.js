/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

const validateOptions = require("schema-utils");
const schema = require("../../schemas/plugins/optimize/LimitChunkCountPlugin.json");
const LazyBucketSortedSet = require("../util/LazyBucketSortedSet");

/** @typedef {import("../../declarations/plugins/optimize/LimitChunkCountPlugin").LimitChunkCountPluginOptions} LimitChunkCountPluginOptions */
/** @typedef {import("../Chunk")} Chunk */
/** @typedef {import("../Compiler")} Compiler */

/**
 * @typedef {Object} ChunkCombination
 * @property {boolean} deleted this is set to true when combination was removed
 * @property {number} sizeDiff
 * @property {number} integratedSize
 * @property {Chunk} a
 * @property {Chunk} b
 * @property {number} aIdx
 * @property {number} bIdx
 * @property {number} aSize
 * @property {number} bSize
 */

const addToSetMap = (map, key, value) => {
	const set = map.get(key);
	if (set === undefined) {
		map.set(key, new Set([value]));
	} else {
		set.add(value);
	}
};

class LimitChunkCountPlugin {
	/**
	 * @param {LimitChunkCountPluginOptions=} options options object
	 */
	constructor(options) {
		if (!options) options = {};

		validateOptions(schema, options, "Limit Chunk Count Plugin");
		this.options = options;
	}

	/**
	 * @param {Compiler} compiler the webpack compiler
	 * @returns {void}
	 */
	apply(compiler) {
		const options = this.options;
		compiler.hooks.compilation.tap("LimitChunkCountPlugin", compilation => {
			compilation.hooks.optimizeChunksAdvanced.tap(
				"LimitChunkCountPlugin",
				chunks => {
					const maxChunks = options.maxChunks;
					if (!maxChunks) return;
					if (maxChunks < 1) return;
					if (chunks.length <= maxChunks) return;

					let remainingChunksToMerge = chunks.length - maxChunks;

					// order chunks in a deterministic way
					const orderedChunks = chunks.slice().sort((a, b) => a.compareTo(b));

					// create a lazy sorted data structure to keep all combinations
					// this is large. Size = chunks * (chunks - 1) / 2
					// It uses a multi layer bucket sort plus normal sort in the last layer
					// It's also lazy so only accessed buckets are sorted
					const combinations = new LazyBucketSortedSet(
						// Layer 1: ordered by largest size benefit
						c => c.sizeDiff,
						(a, b) => b - a,
						// Layer 2: ordered by smallest combined size
						c => c.integratedSize,
						(a, b) => a - b,
						// Layer 3: ordered by position difference in orderedChunk (-> to be deterministic)
						c => c.bIdx - c.aIdx,
						(a, b) => a - b,
						// Layer 4: ordered by position in orderedChunk (-> to be deterministic)
						(a, b) => a.bIdx - b.bIdx
					);

					// we keep a mappng from chunk to all combinations
					// but this mapping is not kept up-to-date with deletions
					// so `deleted` flag need to be considered when iterating this
					/** @type {Map<Chunk, Set<ChunkCombination>>} */
					const combinationsByChunk = new Map();

					orderedChunks.forEach((b, bIdx) => {
						// create combination pairs with size and integrated size
						for (let aIdx = 0; aIdx < bIdx; aIdx++) {
							const a = orderedChunks[aIdx];
							const integratedSize = a.integratedSize(b, options);

							// filter pairs that do not have an integratedSize
							// meaning they can NOT be integrated!
							if (integratedSize === false) continue;

							const aSize = a.size(options);
							const bSize = b.size(options);
							const c = {
								deleted: false,
								sizeDiff: aSize + bSize - integratedSize,
								integratedSize,
								a,
								b,
								aIdx,
								bIdx,
								aSize,
								bSize
							};
							combinations.add(c);
							addToSetMap(combinationsByChunk, a, c);
							addToSetMap(combinationsByChunk, b, c);
						}
						return combinations;
					});

					// list of modified chunks during this run
					// combinations affected by this change are skipped to allow
					// futher optimizations
					/** @type {Set<Chunk>} */
					const modifiedChunks = new Set();

					let changed = false;
					// eslint-disable-next-line no-constant-condition
					loop: while (true) {
						const combination = combinations.popFirst();
						if (combination === undefined) break;

						combination.deleted = true;
						const { a, b, integratedSize } = combination;

						// skip over pair when
						// one of the already merged chunks is a parent of one of the chunks
						if (modifiedChunks.size > 0) {
							const queue = new Set(a.groupsIterable);
							for (const group of b.groupsIterable) {
								queue.add(group);
							}
							for (const group of queue) {
								for (const mChunk of modifiedChunks) {
									if (mChunk !== a && mChunk !== b && mChunk.isInGroup(group)) {
										// This is a potential pair which needs recalculation
										// We can't do that now, but it merge before following pairs
										// so we leave space for it, and consider chunks as modified
										// just for the worse case
										remainingChunksToMerge--;
										if (remainingChunksToMerge <= 0) break loop;
										modifiedChunks.add(a);
										modifiedChunks.add(b);
										continue loop;
									}
								}
								for (const parent of group.parentsIterable) {
									queue.add(parent);
								}
							}
						}

						// merge the chunks
						if (a.integrate(b, "limit")) {
							chunks.splice(chunks.indexOf(b), 1);

							// flag chunk a as modified as further optimization are possible for all children here
							modifiedChunks.add(a);

							changed = true;
							remainingChunksToMerge--;
							if (remainingChunksToMerge <= 0) break;

							// Update all affected combinations
							// delete all combination with the removed chunk
							// we will use combinations with the kept chunk instead
							for (const combination of combinationsByChunk.get(b)) {
								if (combination.deleted) continue;
								combination.deleted = true;
								combinations.delete(combination);
							}

							// Update combinations with the kept chunk with new sizes
							for (const combination of combinationsByChunk.get(a)) {
								if (combination.deleted) continue;
								if (combination.a === a) {
									// Update size
									const newIntegratedSize = a.integratedSize(
										combination.b,
										options
									);
									if (newIntegratedSize === false) {
										combination.deleted = true;
										combinations.delete(combination);
										continue;
									}
									const finishUpdate = combinations.startUpdate(combination);
									combination.integratedSize = newIntegratedSize;
									combination.aSize = integratedSize;
									combination.sizeDiff =
										combination.bSize + integratedSize - newIntegratedSize;
									finishUpdate();
								} else if (combination.b === a) {
									// Update size
									const newIntegratedSize = combination.a.integratedSize(
										a,
										options
									);
									if (newIntegratedSize === false) {
										combination.deleted = true;
										combinations.delete(combination);
										continue;
									}
									const finishUpdate = combinations.startUpdate(combination);
									combination.integratedSize = newIntegratedSize;
									combination.bSize = integratedSize;
									combination.sizeDiff =
										integratedSize + combination.aSize - newIntegratedSize;
									finishUpdate();
								}
							}
						}
					}
					if (changed) return true;
				}
			);
		});
	}
}
module.exports = LimitChunkCountPlugin;
