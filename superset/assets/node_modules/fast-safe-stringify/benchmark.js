const Benchmark = require('benchmark')
const suite = new Benchmark.Suite()
const { inspect } = require('util')
const jsonStringifySafe = require('json-stringify-safe')
const fastSafeStringify = require('./')

const array = new Array(10).fill(0).map((_, i) => i)
const obj = { foo: array }
const circ = JSON.parse(JSON.stringify(obj))
circ.o = { obj: circ, array }
const deep = require('./package.json')
deep.deep = JSON.parse(JSON.stringify(deep))
deep.deep.deep = JSON.parse(JSON.stringify(deep))
deep.deep.deep.deep = JSON.parse(JSON.stringify(deep))
deep.array = array

const deepCirc = JSON.parse(JSON.stringify(deep))
deepCirc.deep.deep.deep.circ = deepCirc
deepCirc.deep.deep.circ = deepCirc
deepCirc.deep.circ = deepCirc
deepCirc.array = array

suite.add('util.inspect:          simple object', function () {
  inspect(obj)
})
suite.add('util.inspect:          circular     ', function () {
  inspect(circ)
})
suite.add('util.inspect:          deep         ', function () {
  inspect(deep)
})
suite.add('util.inspect:          deep circular', function () {
  inspect(deepCirc)
})

suite.add('\njson-stringify-safe:   simple object', function () {
  jsonStringifySafe(obj)
})
suite.add('json-stringify-safe:   circular     ', function () {
  jsonStringifySafe(circ)
})
suite.add('json-stringify-safe:   deep         ', function () {
  jsonStringifySafe(deep)
})
suite.add('json-stringify-safe:   deep circular', function () {
  jsonStringifySafe(deepCirc)
})

suite.add('\nfast-safe-stringify:   simple object', function () {
  fastSafeStringify(obj)
})
suite.add('fast-safe-stringify:   circular     ', function () {
  fastSafeStringify(circ)
})
suite.add('fast-safe-stringify:   deep         ', function () {
  fastSafeStringify(deep)
})
suite.add('fast-safe-stringify:   deep circular', function () {
  fastSafeStringify(deepCirc)
})

// add listeners
suite.on('cycle', function (event) {
  console.log(String(event.target))
})

suite.on('complete', function () {
  console.log('\nFastest is ' + this.filter('fastest').map('name'))
})

suite.run({ delay: 1, minSamples: 150 })
