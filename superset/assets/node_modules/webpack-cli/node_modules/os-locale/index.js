'use strict';
const execa = require('execa');
const lcid = require('lcid');
const mem = require('mem');

const defaultOptions = {spawn: true};
const defaultLocale = 'en_US';

function getEnvLocale(env) {
	env = env || process.env;
	return env.LC_ALL || env.LC_MESSAGES || env.LANG || env.LANGUAGE;
}

function parseLocale(x) {
	const env = x.split('\n').reduce((env, def) => {
		def = def.split('=');
		env[def[0]] = def[1].replace(/^"|"$/g, '');
		return env;
	}, {});
	return getEnvLocale(env);
}

function getLocale(string) {
	return (string && string.replace(/[.:].*/, ''));
}

function getAppleLocale() {
	return execa.stdout('defaults', ['read', '-g', 'AppleLocale']);
}

function getAppleLocaleSync() {
	return execa.sync('defaults', ['read', '-g', 'AppleLocale']).stdout;
}

function getUnixLocale() {
	if (process.platform === 'darwin') {
		return getAppleLocale();
	}

	return execa.stdout('locale')
		.then(stdout => getLocale(parseLocale(stdout)));
}

function getUnixLocaleSync() {
	if (process.platform === 'darwin') {
		return getAppleLocaleSync();
	}

	return getLocale(parseLocale(execa.sync('locale').stdout));
}

function getWinLocale() {
	return execa.stdout('wmic', ['os', 'get', 'locale'])
		.then(stdout => {
			const lcidCode = parseInt(stdout.replace('Locale', ''), 16);
			return lcid.from(lcidCode);
		});
}

function getWinLocaleSync() {
	const {stdout} = execa.sync('wmic', ['os', 'get', 'locale']);
	const lcidCode = parseInt(stdout.replace('Locale', ''), 16);
	return lcid.from(lcidCode);
}

module.exports = mem((options = defaultOptions) => {
	const envLocale = getEnvLocale();

	let thenable;
	if (envLocale || options.spawn === false) {
		thenable = Promise.resolve(getLocale(envLocale));
	} else if (process.platform === 'win32') {
		thenable = getWinLocale();
	} else {
		thenable = getUnixLocale();
	}

	return thenable.then(locale => locale || defaultLocale)
		.catch(() => defaultLocale);
});

module.exports.sync = mem((options = defaultOptions) => {
	const envLocale = getEnvLocale();

	let res;
	if (envLocale || options.spawn === false) {
		res = getLocale(envLocale);
	} else {
		try {
			if (process.platform === 'win32') {
				res = getWinLocaleSync();
			} else {
				res = getUnixLocaleSync();
			}
		} catch (_) {}
	}

	return res || defaultLocale;
});
