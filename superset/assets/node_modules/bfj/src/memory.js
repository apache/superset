'use strict'

const PROPERTIES = [ 'rss', 'heapTotal', 'heapUsed', 'external' ]

let memory

module.exports = {
  initialise,
  update,
  report
}

function initialise () {
  memory = PROPERTIES.reduce((result, name) => {
    result[name] = {
      sum: 0,
      hwm: 0
    }
    return result
  }, { count: 0 })
}

function update () {
  const currentMemory = process.memoryUsage()
  PROPERTIES.forEach(name => updateProperty(name, currentMemory))
}

function updateProperty (name, currentMemory) {
  const m = memory[name]
  const c = currentMemory[name]
  m.sum += c
  if (c > m.hwm) {
    m.hwm = c
  }
}

function report () {
  PROPERTIES.forEach(name => reportProperty(name))
}

function reportProperty (name) {
  const m = memory[name]
  // eslint-disable-next-line no-console
  console.log(`mean ${name}: ${m.sum / memory.count}; hwm: ${m.hwm}`)
}
