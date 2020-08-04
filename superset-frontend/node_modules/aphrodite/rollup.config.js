import babel from 'rollup-plugin-babel';
import commonjs from 'rollup-plugin-commonjs';
import replace from 'rollup-plugin-replace';
import resolve from 'rollup-plugin-node-resolve';
import {uglify} from 'rollup-plugin-uglify';

import pkg from './package.json';

function distBuild(options) {
    options = options || {};

    return {
        input: 'src/index.js',
        output: {
            file: `dist/${options.filename}`,
            format: options.format,
            name: 'aphrodite',
            sourcemap: options.sourcemap,
        },
        plugins: [
            babel({
                exclude: ['node_modules/**'],
            }),
            replace({
                'process.env.NODE_ENV': JSON.stringify('production'),
            }),
            resolve({
                browser: true,
            }), // so rollup can find node modules
            commonjs(), // so rollup can convert node modules to ESM if needed
            options.minify && uglify(),
        ]
    };
}

const externals = new Set(Object.keys(pkg.dependencies));

function standardBuilds() {
    return {
        input: ['src/index.js', 'src/no-important.js'],
        external: (id /*: string */) => {
            if (externals.has(id)) {
                return true;
            }

            // Mark deep imports from inline-style-prefixer as external.
            return /^inline-style-prefixer\//.test(id);
        },
        output: [
            { dir: 'lib', format: 'cjs' },
            { dir: 'es', format: 'es' },
        ],
        plugins: [
            babel({
                exclude: ['node_modules/**'],
            }),
            commonjs(), // so rollup can convert node modules to ESM if needed
        ],
    };
}

export default [
    distBuild({ filename: 'aphrodite.umd.js', format: 'umd', sourcemap: true, minify: false }),
    distBuild({ filename: 'aphrodite.umd.min.js', format: 'umd', sourcemap: true, minify: true }),
    distBuild({ filename: 'aphrodite.js', format: 'cjs', sourcemap: false, minify: false }),
    standardBuilds(),
];
