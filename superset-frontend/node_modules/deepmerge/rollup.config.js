import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'

var pkg = require('./package.json')

export default {
	input: 'index.js',
	name: 'deepmerge',
	plugins: [
		commonjs(),
		resolve()
	],
	output: [
		{ file: pkg.main, format: 'umd' },
		{ file: pkg.module, format: 'es' },
		{ file: pkg.browser, format: 'cjs' },
	]
}
