/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/

"use strict";

const mergeCache = new WeakMap();

/**
 * Merges two given objects and caches the result to avoid computation if same objects passed as arguments again.
 * @example
 * // performs cleverMerge(first, second), stores the result in WeakMap and returns result
 * cachedCleverMerge({a: 1}, {a: 2})
 * {a: 2}
 *  // when same arguments passed, gets the result from WeakMap and returns it.
 * cachedCleverMerge({a: 1}, {a: 2})
 * {a: 2}
 * @param {object} first first object
 * @param {object} second second object
 * @returns {object} merged object of first and second object
 */
const cachedCleverMerge = (first, second) => {
	let innerCache = mergeCache.get(first);
	if (innerCache === undefined) {
		innerCache = new WeakMap();
		mergeCache.set(first, innerCache);
	}
	const prevMerge = innerCache.get(second);
	if (prevMerge !== undefined) return prevMerge;
	const newMerge = cleverMerge(first, second);
	innerCache.set(second, newMerge);
	return newMerge;
};

/**
 * Merges two objects. Objects are not deeply merged.
 * TODO webpack 5: merge objects deeply clever.
 * Arrays might reference the old value with "..."
 * @param {object} first first object
 * @param {object} second second object
 * @returns {object} merged object of first and second object
 */
const cleverMerge = (first, second) => {
	const newObject = Object.assign({}, first);
	for (const key of Object.keys(second)) {
		if (!(key in newObject)) {
			newObject[key] = second[key];
			continue;
		}
		const secondValue = second[key];
		if (!Array.isArray(secondValue)) {
			newObject[key] = secondValue;
			continue;
		}
		const firstValue = newObject[key];
		if (Array.isArray(firstValue)) {
			const newArray = [];
			for (const item of secondValue) {
				if (item === "...") {
					for (const item of firstValue) {
						newArray.push(item);
					}
				} else {
					newArray.push(item);
				}
			}
			newObject[key] = newArray;
		} else {
			newObject[key] = secondValue;
		}
	}
	return newObject;
};

exports.cachedCleverMerge = cachedCleverMerge;
exports.cleverMerge = cleverMerge;
