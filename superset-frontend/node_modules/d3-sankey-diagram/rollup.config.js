import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import buble from 'rollup-plugin-buble'
import pkg from './package.json'

const d3External = [
  'd3-collection',
  'd3-array',
  'd3-selection',
  'd3-transition',
  'd3-dispatch',
  'd3-format',
  'd3-interpolate'
]

const globals = {}
d3External.forEach(k => {
  globals[k] = 'd3'
})

export default [
  // browser-friendly UMD build
  {
    entry: 'src/index.js',
    dest: pkg.browser,
    format: 'umd',
    moduleName: 'd3',
    extend: true,
    globals: globals,
    external: d3External,
    plugins: [
      resolve(), // find modules in node_modules
      commonjs({ // convert CommonJS to ES modules so they can be loaded
        // namedExports: {
        //   'node_modules/graphlib/index.js': ['Graph', 'alg']
        // }
      }),
      buble({  // transpile ES2015+ to ES5
        exclude: ['node_modules/**']
      })
    ]
  },

  // CommonJS (for Node) and ES module (for bundlers) build.
  // (We could have three entries in the configuration array
  // instead of two, but it's quicker to generate multiple
  // builds from a single configuration where possible, using
  // the `targets` option which can specify `dest` and `format`)
  {
    entry: 'src/index.js',
    external: [...d3External, 'graphlib'],
    targets: [
      { dest: pkg.main, format: 'cjs' },
      { dest: pkg.module, format: 'es' }
    ],
    plugins: [
      buble({
        exclude: ['node_modules/**']
      })
    ]
  }
]
