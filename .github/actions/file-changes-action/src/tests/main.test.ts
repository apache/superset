import {Env, getTestEvents, getTestFiles, p} from './mocks/env'

let env: Env

describe('Testing main.ts...', () => {
  describe.each(p.testEvents)('...with %s event...', event => {
    /**
     * @function run
     */
    describe('...with function run...', () => {
      describe.each(getTestEvents(p.getFormatExtInputs, 'push'))(
        '...with fileOutput %s...',
        (fileOutputName, fileOutputInput, fileOutputExpected) => {
          describe.each(getTestEvents(p.getFormatExtInputs, 'push'))(
            '...with output %o...',
            (outputName, outputInput, outputExpected) => {
              describe.each(getTestEvents(p.mainInputs, event))(
                '...with %s event inputs mocked...',
                (eventName, eventInput, eventExpected) => {
                  beforeEach(() => {
                    env = new Env(
                      {},
                      {
                        githubRepo: 'trilom/file-changes-action',
                        githubToken: 'TestToken',
                        output: outputInput,
                        fileOutput: fileOutputInput,
                        ...eventInput,
                        mock: 'true'
                      },
                      event
                    )
                  })
                  afterEach(() => {
                    process.env = env.envStart
                    jest.resetModules()
                    jest.unmock('@actions/core')
                    jest.unmock('@actions/github')
                    jest.unmock('../InputHelper')
                    jest.unmock('../FilesHelper')
                    jest.unmock('../GithubHelper')
                  })
                  it('...mocked', async () => {
                    const githubHelper = require('../GithubHelper')
                    const filesHelper = require('../FilesHelper')
                    githubHelper.getChangedFiles = jest.fn(
                      () => getTestFiles().files
                    )
                    filesHelper.writeOutput = jest.fn(() => {})
                    filesHelper.writeFiles = jest.fn(() => {})
                    await expect(require('../main').run()).resolves.toBe(
                      undefined
                    )
                    expect(githubHelper.getChangedFiles).toBeCalled()
                    expect(filesHelper.writeOutput).toBeCalled()
                    expect(filesHelper.writeFiles).toBeCalled()
                  })
                  it.each(getTestEvents(p.mainErrorInputs, 'push'))(
                    '...throws error for mocked function %s...',
                    async (f, e, expected) => {
                      const inputHelper = require('../InputHelper')
                      let thrown = false
                      inputHelper.getInputs = jest.fn(() => {
                        thrown = true
                        throw new Error(e)
                      })
                      await expect(
                        require('../main').run()
                      ).rejects.toThrowError(
                        new Error(
                          JSON.stringify({
                            name: 'Error',
                            message: 'Error',
                            from: f
                          })
                        )
                      )
                      expect(inputHelper.getInputs).toHaveBeenCalledTimes(1)
                    }
                  )
                }
              )
            }
          )
        }
      )
    })
  })
})
