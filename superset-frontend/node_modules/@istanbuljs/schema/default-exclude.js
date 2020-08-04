'use strict';

module.exports = [
	'coverage/**',
	'packages/*/test{,s}/**',
	'**/*.d.ts',
	'test{,s}/**',
	'test{,-*}.{js,cjs,mjs,ts}',
	'**/*{.,-}test.{js,cjs,mjs,ts}',
	'**/__tests__/**',

	/* Exclude common development tool configuration files */
	'**/{ava,nyc}.config.{js,cjs,mjs}',
	'**/jest.config.{js,cjs,mjs,ts}',
	'**/{karma,rollup,webpack}.config.js',
	'**/{babel.config,.eslintrc,.mocharc}.{js,cjs}'
];
