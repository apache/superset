#!/usr/bin/env node

'use strict'

const fs = require('fs')
const path = require('path')
const check = require('check-types')
const bfj = require('../src')

console.log('reading json')

let time = process.hrtime()

bfj.read(getDataPath('.json'))
  .then(data => {
    reportTime()
    console.log('writing json')
    return bfj.write(getDataPath('-result.json'), data)
  })
  .then(() => done('succeeded'))
  .catch(error => done(error.stack, 1))

function getDataPath (suffix) {
  return path.resolve(__dirname, process.argv[2] + suffix)
}

function reportTime () {
  let interimTime = process.hrtime(time)
  console.log('%d seconds and %d nanoseconds', interimTime[0], interimTime[1])
  time = process.hrtime()
}

function done (message, code) {
  reportTime()
  console.log(message)
  process.exit(code)
}

