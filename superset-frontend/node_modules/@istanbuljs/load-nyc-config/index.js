'use strict';

const fs = require('fs');
const path = require('path');
const {promisify} = require('util');
const camelcase = require('camelcase');
const findUp = require('find-up');
const resolveFrom = require('resolve-from');

const readFile = promisify(fs.readFile);

const standardConfigFiles = [
	'.nycrc',
	'.nycrc.json',
	'.nycrc.yml',
	'.nycrc.yaml',
	'nyc.config.js',
	'nyc.config.cjs',
	'nyc.config.mjs'
];

function camelcasedConfig(config) {
	const results = {};
	for (const [field, value] of Object.entries(config)) {
		results[camelcase(field)] = value;
	}

	return results;
}

async function findPackage(options) {
	const cwd = options.cwd || process.env.NYC_CWD || process.cwd();
	const pkgPath = await findUp('package.json', {cwd});
	if (pkgPath) {
		const pkgConfig = JSON.parse(await readFile(pkgPath, 'utf8')).nyc || {};
		if ('cwd' in pkgConfig) {
			pkgConfig.cwd = path.resolve(path.dirname(pkgPath), pkgConfig.cwd);
		}

		return {
			cwd: path.dirname(pkgPath),
			pkgConfig
		};
	}

	return {
		cwd,
		pkgConfig: {}
	};
}

async function actualLoad(configFile) {
	if (!configFile) {
		return {};
	}

	const configExt = path.extname(configFile).toLowerCase();
	switch (configExt) {
		case '.js':
		case '.cjs':
			return require(configFile);
		/* istanbul ignore next: coverage for 13.2.0+ is shown in load-esm.js */
		case '.mjs':
			return require('./load-esm')(configFile);
		case '.yml':
		case '.yaml':
			return require('js-yaml').load(await readFile(configFile, 'utf8'));
		default:
			return JSON.parse(await readFile(configFile, 'utf8'));
	}
}

async function applyExtends(config, filename, loopCheck = new Set()) {
	config = camelcasedConfig(config);
	if ('extends' in config) {
		const extConfigs = [].concat(config.extends);
		if (extConfigs.some(e => typeof e !== 'string')) {
			throw new TypeError(`${filename} contains an invalid 'extends' option`);
		}

		delete config.extends;
		const filePath = path.dirname(filename);
		for (const extConfig of extConfigs) {
			const configFile = resolveFrom.silent(filePath, extConfig) ||
				resolveFrom.silent(filePath, './' + extConfig);
			if (!configFile) {
				throw new Error(`Could not resolve configuration file ${extConfig} from ${path.dirname(filename)}.`);
			}

			if (loopCheck.has(configFile)) {
				throw new Error(`Circular extended configurations: '${configFile}'.`);
			}

			loopCheck.add(configFile);

			// eslint-disable-next-line no-await-in-loop
			const configLoaded = await actualLoad(configFile);
			if ('cwd' in configLoaded) {
				configLoaded.cwd = path.resolve(path.dirname(configFile), configLoaded.cwd);
			}

			Object.assign(
				config,
				// eslint-disable-next-line no-await-in-loop
				await applyExtends(configLoaded, configFile, loopCheck)
			);
		}
	}

	return config;
}

async function loadNycConfig(options = {}) {
	const {cwd, pkgConfig} = await findPackage(options);
	const configFiles = [].concat(options.nycrcPath || standardConfigFiles);
	const configFile = await findUp(configFiles, {cwd});
	if (options.nycrcPath && !configFile) {
		throw new Error(`Requested configuration file ${options.nycrcPath} not found`);
	}

	const config = {
		cwd,
		...(await applyExtends(pkgConfig, path.join(cwd, 'package.json'))),
		...(await applyExtends(await actualLoad(configFile), configFile))
	};

	const arrayFields = ['require', 'extension', 'exclude', 'include'];
	for (const arrayField of arrayFields) {
		if (config[arrayField]) {
			config[arrayField] = [].concat(config[arrayField]);
		}
	}

	return config;
}

module.exports = {
	loadNycConfig
};
