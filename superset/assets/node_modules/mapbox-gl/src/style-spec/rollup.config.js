import replace from 'rollup-plugin-replace';
import buble from 'rollup-plugin-buble';
import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import unassert from 'rollup-plugin-unassert';
import json from 'rollup-plugin-json';
import {flow} from '../../build/rollup_plugins';

const config = [{
    input: `${__dirname}/style-spec.js`,
    output: {
        name: 'mapboxGlStyleSpecification',
        file: `${__dirname}/dist/index.js`,
        format: 'umd',
        sourcemap: true
    },
    plugins: [
        // https://github.com/zaach/jison/issues/351
        replace({
            include: /\/jsonlint-lines-primitives\/lib\/jsonlint.js/,
            delimiters: ['', ''],
            values: {
                '_token_stack:': ''
            }
        }),
        flow(),
        json(),
        buble({transforms: {dangerousForOf: true}, objectAssign: "Object.assign"}),
        unassert(),
        resolve({
            browser: true,
            preferBuiltins: false
        }),
        commonjs()
    ]
}];
export default config;
