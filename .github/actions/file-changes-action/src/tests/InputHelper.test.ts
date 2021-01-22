import {Env, eventName, getTestEvents, p} from './mocks/env'

let env: Env

describe('Testing InputHelper.ts...', () => {
  describe.each(p.testEvents)('...with %s event...', event => {
    beforeAll(() => {
      env = new Env({}, {githubToken: 'TestToken'}, event)
    })
    afterEach(() => {
      process.env = {...env.envStart}
      jest.resetModules()
      env = new Env({}, {}, event)
    })
    /**
     * @function getInputs
     */
    describe('...with function getInputs...', () => {
      it('...sets correct default input parameters.', () => {
        const {payload, issue, eventName: contextEventName} = env.context
        const {
          prNumber,
          pushAfter,
          pushBefore,
          githubToken,
          githubRepo,
          output,
          fileOutput,
          event: inputEventName
        } = require('../InputHelper').getInputs()
        const {getInput} = require('@actions/core')
        if (event.includes('push')) {
          expect(prNumber).toBe(NaN)
          expect(pushAfter).toBe(payload.after)
          expect(pushBefore).toBe(payload.before)
        }
        if (event.includes('pull_request') || event.includes('issue_comment')) {
          expect(prNumber).toBe(issue.number)
          if (event === 'pull_request_synchronize') {
            expect(pushAfter).toBe(payload.after)
            expect(pushBefore).toBe(payload.before)
          } else {
            expect(pushAfter).toBeFalsy()
            expect(pushBefore).toBeFalsy()
          }
        }
        expect(githubToken).toBe(process.env.INPUT_GITHUBTOKEN)
        expect(githubRepo).toBe(process.env.GITHUB_REPOSITORY)
        expect(output).toBe(' ')
        expect(fileOutput).toBe(' ')
        expect(inputEventName).toBe(contextEventName)
        expect(getInput).toHaveBeenCalled()
      })
      it('...throws error with no token (undefined) process.env["GITHUB_TOKEN"] or (undefined) input githubToken', () => {
        delete process.env.GITHUB_TOKEN
        delete process.env.INPUT_GITHUBTOKEN
        const {getInput} = require('@actions/core')
        expect(() => {
          require('../InputHelper').getInputs()
        }).toThrowError()
        expect(getInput).toHaveBeenCalledTimes(1)
      })
      it('...throws error with empty string ("") process.env["GITHUB_TOKEN"] or empty string ("") input githubToken', () => {
        env.updateInput({githubToken: ''})
        process.env.GITHUB_TOKEN = ''
        const {getInput} = require('@actions/core')
        expect(() => {
          require('../InputHelper').getInputs()
        }).toThrowError()
        expect(getInput).toHaveBeenCalledTimes(1)
      })
      it.each(getTestEvents(p.inputTestInputs, event))(
        '...sets %s input "%s" should be %p',
        (inputName, input, expected) => {
          env.updateInput({[inputName]: input})
          const {payload, issue, eventName: contextEventName} = env.context
          const {
            prNumber,
            pushAfter,
            pushBefore,
            githubToken,
            githubRepo,
            output,
            fileOutput,
            event: inputEventName
          } = require('../InputHelper').getInputs()
          const {getInput} = require('@actions/core')
          if (event.includes('push')) {
            expect(prNumber).toBe(inputName === 'prNumber' ? expected : NaN)
            expect(pushAfter).toBe(
              inputName === 'pushAfter' ? expected : payload.after
            )
            expect(pushBefore).toBe(
              inputName === 'pushBefore' ? expected : payload.before
            )
          }
          if (
            event.includes('pull_request') ||
            event.includes('issue_comment')
          ) {
            expect(prNumber).toBe(
              inputName === 'prNumber' ? expected : issue.number
            )
            if (event === 'pull_request_synchronize') {
              expect(pushAfter).toBe(
                inputName === 'pushAfter' ? expected : payload.after
              )
              expect(pushBefore).toBe(
                inputName === 'pushBefore' ? expected : payload.before
              )
            } else {
              expect(pushAfter).toBe(
                inputName === 'pushAfter' ? expected : false
              )
              expect(pushBefore).toBe(
                inputName === 'pushBefore' ? expected : false
              )
            }
          }
          expect(githubToken).toBe(
            inputName === 'githubToken' ? expected : 'EnvDefaultToken'
          )
          expect(githubRepo).toBe(
            inputName === 'githubRepo'
              ? expected
              : process.env.GITHUB_REPOSITORY
          )
          expect(output).toBe(inputName === 'output' ? expected : ' ')
          expect(fileOutput).toBe(inputName === 'fileOutput' ? expected : ' ')
          expect(inputEventName).toBe(contextEventName)
          expect(getInput).toBeCalled()
        }
      )
    })
    /**
     * @function inferInput
     */
    describe('...with function inferInput...', () => {
      it.each(getTestEvents(p.inferTestInputs, event))(
        '...%s',
        (title, input, expected) => {
          const {error} = require('@actions/core')
          const {warning} = require('@actions/core')
          if (title.includes('ERROR with no')) {
            expect(() => {
              require('../InputHelper').inferInput(
                input.before,
                input.after,
                input.pr
              )
            }).toThrowError(
              new Error(
                JSON.stringify(
                  {
                    error: '500/inferInput Error',
                    from: 'inferInput',
                    message: `Received event from ${eventName(
                      event
                    )}, but received no inputs. {event_name:${eventName(
                      event
                    )}, pr: NaN, before:, after:}`,
                    payload: ''
                  },
                  null,
                  2
                )
              )
            )
          } else if (title.includes('ERROR with single')) {
            expect(() => {
              require('../InputHelper').inferInput(
                input.before,
                input.after,
                input.pr
              )
            }).toThrowError(
              new Error(
                JSON.stringify(
                  {
                    error: '500/inferInput Error',
                    from: 'inferInput',
                    message: `Received event from ${eventName(
                      event
                    )}, but only received a before(${input.before}) or after(${
                      input.after
                    }).\n I need both of these if you want to use a Push event.`,
                    payload: ''
                  },
                  null,
                  2
                )
              )
            )
          } else {
            const data = require('../InputHelper').inferInput(
              input.before,
              input.after,
              input.pr
            )
            Object.keys(data).forEach(key =>
              expect(data[key]).toBe(expected[key])
            )
            expect(error).not.toHaveBeenCalled()
          }
          if (title.includes('WARN weird'))
            expect(warning).toHaveBeenCalledWith(
              expect.stringContaining(
                `received a before(${input.before}) or after(${input.after}) value.`
              )
            )
          if (title.includes('WARN all'))
            expect(warning).toHaveBeenCalledWith(
              expect.stringContaining(
                `but received a before(${input.before}), after(${input.after}), and PR(${input.pr}).`
              )
            )
          else expect(error).not.toHaveBeenCalled()
        }
      )
    })
  })
})
