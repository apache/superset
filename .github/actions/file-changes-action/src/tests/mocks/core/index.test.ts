import {mock} from '.'

const core = mock()

describe('Testing CoreMock object...', () => {
  beforeAll(() => jest.restoreAllMocks())
  it('...CoreMock is a mock', () => {
    expect(jest.isMockFunction(core.getInput)).toBe(true)
    expect(jest.isMockFunction(core.setFailed)).toBe(true)
    expect(jest.isMockFunction(core.setOutput)).toBe(true)
    expect(jest.isMockFunction(core.debug)).toBe(true)
    expect(jest.isMockFunction(core.warning)).toBe(true)
    expect(jest.isMockFunction(core.info)).toBe(true)
    expect(jest.isMockFunction(core.error)).toBe(true)
  })
  it('...CoreMock mocks core', () => {
    const realCore = require('@actions/core')
    expect(core).toMatchObject(realCore)
  })
  it('...CoreMock mocks setFailed', () => {
    core.setFailed('Test Message')
    expect(core.error).toBeCalledWith('Test Message')
    expect(core.setFailed).toBeCalledWith('Test Message')
  })
  it('...CoreMock mocks setOutput', () => {
    core.setOutput('TestName', 'TestValue')
    expect(core.setOutput).toBeCalledWith('TestName', 'TestValue')
  })
  it('...CoreMock mocks setOutput error', () => {
    expect(() => core.setOutput('ERROROUTPUT', 'TestValue')).toThrowError(
      new Error(JSON.stringify({name: 'CoreError', status: '500'}))
    )
  })
  it('...CoreMock mocks getInput', () => {
    process.env.INPUT_TEST = 'TESTINPUT'
    const input = core.getInput('TEST')
    expect(input).toBe('TESTINPUT')
  })
  it('...CoreMock mocks debug', () => {
    core.debug('Test Message')
    expect(core.debug).toBeCalledWith('Test Message')
  })
  it('...CoreMock mocks warning', () => {
    core.warning('Test Message')
    expect(core.warning).toBeCalledWith('Test Message')
  })
  it('...CoreMock mocks info', () => {
    core.info('Test Message')
    expect(core.info).toBeCalledWith('Test Message')
  })
  it('...CoreMock mocks error', () => {
    core.error('Test Message')
    expect(core.error).toBeCalledWith('Test Message')
  })
})
