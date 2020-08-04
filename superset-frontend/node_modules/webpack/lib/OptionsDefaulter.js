/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
"use strict";

/**
 * Gets the value at path of object
 * @param {object} obj object to query
 * @param {string} path query path
 * @returns {any} - if {@param path} requests element from array, then `undefined` will be returned
 */
const getProperty = (obj, path) => {
	let name = path.split(".");
	for (let i = 0; i < name.length - 1; i++) {
		obj = obj[name[i]];
		if (typeof obj !== "object" || !obj || Array.isArray(obj)) return;
	}
	return obj[name.pop()];
};

/**
 * Sets the value at path of object. Stops execution, if {@param path} requests element from array to be set
 * @param {object} obj object to query
 * @param {string} path query path
 * @param {any} value value to be set
 * @returns {void}
 */
const setProperty = (obj, path, value) => {
	let name = path.split(".");
	for (let i = 0; i < name.length - 1; i++) {
		if (typeof obj[name[i]] !== "object" && obj[name[i]] !== undefined) return;
		if (Array.isArray(obj[name[i]])) return;
		if (!obj[name[i]]) obj[name[i]] = {};
		obj = obj[name[i]];
	}
	obj[name.pop()] = value;
};

/**
 * @typedef {'call' | 'make' | 'append'} ConfigType
 */
/**
 * @typedef {(options: object) => any} MakeConfigHandler
 */
/**
 * @typedef {(value: any, options: object) => any} CallConfigHandler
 */
/**
 * @typedef {any[]} AppendConfigValues
 */

class OptionsDefaulter {
	constructor() {
		/**
		 * Stores default options settings or functions for computing them
		 */
		this.defaults = {};
		/**
		 * Stores configuration for options
		 * @type {{[key: string]: ConfigType}}
		 */
		this.config = {};
	}

	/**
	 * Enhancing {@param options} with default values
	 * @param {object} options provided options
	 * @returns {object} - enhanced options
	 * @throws {Error} - will throw error, if configuration value is other then `undefined` or {@link ConfigType}
	 */
	process(options) {
		options = Object.assign({}, options);
		for (let name in this.defaults) {
			switch (this.config[name]) {
				/**
				 * If {@link ConfigType} doesn't specified and current value is `undefined`, then default value will be assigned
				 */
				case undefined:
					if (getProperty(options, name) === undefined) {
						setProperty(options, name, this.defaults[name]);
					}
					break;
				/**
				 * Assign result of {@link CallConfigHandler}
				 */
				case "call":
					setProperty(
						options,
						name,
						this.defaults[name].call(this, getProperty(options, name), options)
					);
					break;
				/**
				 * Assign result of {@link MakeConfigHandler}, if current value is `undefined`
				 */
				case "make":
					if (getProperty(options, name) === undefined) {
						setProperty(options, name, this.defaults[name].call(this, options));
					}
					break;
				/**
				 * Adding {@link AppendConfigValues} at the end of the current array
				 */
				case "append": {
					let oldValue = getProperty(options, name);
					if (!Array.isArray(oldValue)) {
						oldValue = [];
					}
					oldValue.push(...this.defaults[name]);
					setProperty(options, name, oldValue);
					break;
				}
				default:
					throw new Error(
						"OptionsDefaulter cannot process " + this.config[name]
					);
			}
		}
		return options;
	}

	/**
	 * Builds up default values
	 * @param {string} name option path
	 * @param {ConfigType | any} config if {@param def} is provided, then only {@link ConfigType} is allowed
	 * @param {MakeConfigHandler | CallConfigHandler | AppendConfigValues} [def] defaults
	 * @returns {void}
	 */
	set(name, config, def) {
		if (def !== undefined) {
			this.defaults[name] = def;
			this.config[name] = config;
		} else {
			this.defaults[name] = config;
			delete this.config[name];
		}
	}
}

module.exports = OptionsDefaulter;
