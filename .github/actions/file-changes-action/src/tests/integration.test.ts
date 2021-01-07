import {existsSync, mkdirSync, readFileSync, rmdirSync, unlinkSync} from 'fs'
import {resolve as _resolve} from 'path'
import {
  eventName as formatEventName,
  formatInput,
  getTestEvents,
  p
} from './mocks/env'

// debugger

const pEnv: {[key: string]: string | undefined} = {...process.env}

let processStdoutMock: jest.SpyInstance
let consoleLogMock: jest.SpyInstance
let output = ''

describe.each(p.testEvents)('Testing main.ts with %s event...', event => {
  /**
   * @function run
   */
  describe.each(getTestEvents(p.mainInputs, event))(
    '...function run with %s event inputs non mocked...',
    (eventName, eventInput, eventExpected) => {
      describe.each(getTestEvents(p.getFormatExtInputs, 'push'))(
        '...with output %s...',
        (outputName, outputInput, outputExpected) => {
          describe.each(getTestEvents(p.getFormatExtInputs, 'push'))(
            '...with fileOutput %s...',
            (fileOutputName, fileOutputInput, fileOutputExpected) => {
              beforeEach(() => {
                consoleLogMock = jest
                  .spyOn(console, 'log')
                  .mockImplementation((message: string) => {
                    output += ` ${message}`
                  })
                processStdoutMock = jest
                  .spyOn(process.stdout, 'write')
                  .mockImplementation(
                    (
                      command: string | Uint8Array,
                      encoding?: string,
                      cb?: () => void
                    ) => {
                      output += ` ${command}`
                      return false
                    }
                  )
                mkdirSync(
                  _resolve(
                    __dirname,
                    `outputs/${event}/${eventName}/o_${outputName}f_${fileOutputName}`
                  ),
                  {recursive: true}
                )
                process.env = {
                  HOME: _resolve(
                    __dirname,
                    `outputs/${event}/${eventName}/o_${outputName}f_${fileOutputName}`
                  ),
                  GITHUB_EVENT_NAME: formatEventName(event),
                  GITHUB_EVENT_PATH: _resolve(
                    __dirname,
                    `mocks/env/events/${event}.json`
                  ),
                  ...formatInput({
                    githubRepo: 'trilom/file-changes-action',
                    githubToken: process.env.GITHUB_TOKEN || '',
                    output: outputInput,
                    fileOutput: fileOutputInput,
                    ...eventInput
                  })
                }
              })
              afterEach(() => {
                process.env = {...pEnv}
                output = ''
                jest.restoreAllMocks()
              })
              it('...no-mock', async () => {
                await expect(require('../main').run()).resolves.toBe(undefined)
                const counts = {
                  files: 73,
                  files_added: 52,
                  files_modified: 13,
                  files_removed: 8
                } as {[key: string]: number}
                Object.keys(counts).forEach(async key => {
                  expect(output).toContain(`::set-output name=${key}`)
                  expect(
                    existsSync(
                      _resolve(
                        __dirname,
                        `outputs/${event}/${eventName}/o_${outputName}f_${fileOutputName}/${key}${fileOutputExpected}`
                      )
                    )
                  ).toBeTruthy()
                  if (fileOutputExpected === '.json') {
                    expect(
                      JSON.parse(
                        readFileSync(
                          _resolve(
                            __dirname,
                            `outputs/${event}/${eventName}/o_${outputName}f_${fileOutputName}/${key}${fileOutputExpected}`
                          ),
                          'utf8'
                        )
                      )
                    ).toHaveLength(counts[key])
                  } else {
                    expect(
                      readFileSync(
                        _resolve(
                          __dirname,
                          `outputs/${event}/${eventName}/o_${outputName}f_${fileOutputName}/${key}${fileOutputExpected}`
                        ),
                        'utf8'
                      ).split(fileOutputInput)
                    ).toHaveLength(counts[key])
                  }
                })
              }, 10000)
            }
          )
        }
      )
    }
  )
})
