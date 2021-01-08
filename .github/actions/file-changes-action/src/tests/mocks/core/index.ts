import {CoreMock} from 'typings/CoreMock'

const coreMock: CoreMock = {
  setFailed: jest.fn(message => {
    coreMock.error(message)
    // console.error(`setFailed triggered`)
  }),
  setOutput: jest.fn((name, value) => {
    if (name === 'ERROROUTPUT')
      throw new Error(JSON.stringify({name: 'CoreError', status: '500'}))
    // console.log(`setOutputName: ${name} value: ${value}`)
  }),
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getInput: jest.fn((name, options) => {
    return process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`]
  }),
  debug: jest.fn(message => {
    // console.debug(`core.debug triggered: ${message}`)
  }),
  warning: jest.fn(message => {
    // console.warn(`core.warning triggered: ${message}`)
  }),
  info: jest.fn(message => {
    // console.info(`core.info triggered: ${message}`)
  }),
  error: jest.fn(message => {
    // console.error(`core.error triggered: ${message}`)
  })
}

export function mock(): CoreMock {
  jest.mock('@actions/core', () => coreMock)
  return coreMock
}
