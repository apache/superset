import {Env, p, getTestEvents} from './mocks/env'

let env: Env

describe('Testing GithubHelper.ts...', () => {
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
     * @function initClient
     */
    describe('...with function initClientTests...', () => {
      it.each(getTestEvents(p.initClientTestInputs, event))(
        '...%s',
        async (title, input, expected) => {
          process.env = {...env.envStart}
          env = new Env({}, {}, event)
          let gh
          if (title.includes('without a token'))
            expect(() =>
              require('../GithubHelper').initClient(input)
            ).toThrowError(
              new Error(
                JSON.stringify(
                  {
                    error: '500/Error',
                    from: 'initClient',
                    message:
                      'There was an error creating github client. Please check your token.',
                    payload: {}
                  },
                  null,
                  2
                )
              )
            )
          else {
            gh = require('../GithubHelper').initClient(input)
            const {GitHub} = require('@actions/github')
            expect(GitHub).toHaveBeenCalledTimes(1)
            expect(GitHub).toHaveBeenCalledWith(expected)
            expect(gh).toEqual(env.octokitMock)
          }
        }
      )
    })
    /**
     * @function getChangedPRFiles
     */
    describe('...with function getChangedPRFiles...', () => {
      it.each(getTestEvents(p.getChangedPRFilesTestInputs, event))(
        '...%s',
        async (title, input, expected) => {
          if (title.includes('throws an error')) {
            expect.assertions(1)
            await expect(
              require('../GithubHelper').getChangedPRFiles(
                env.octokitMock,
                input.repo,
                input.owner,
                input.pullNumber
              )
            ).rejects.toThrowError(new Error(JSON.stringify(expected, null, 2)))
          } else {
            let files: any[] = []
            files = await require('../GithubHelper').getChangedPRFiles(
              env.octokitMock,
              input.repo,
              input.owner,
              input.pullNumber
            )
            expect(files).toStrictEqual(expected)
            expect(files.length).toBe(7)
          }
        }
      )
      it('...throws errows', async () => {
        await expect(
          require('../GithubHelper').getChangedPRFiles(
            env.octokitMock,
            'trilom/file-changes-action',
            'error',
            'error'
          )
        ).rejects.toThrowError(
          new Error(
            JSON.stringify(
              {
                error: '500/Unknown Error:Error',
                from: 'getChangedPRFiles',
                message:
                  'There was an error getting change files for repo:trilom/file-changes-action owner:error pr:error',
                payload: JSON.stringify({name: 'HttpError', status: '500'})
              },
              null,
              2
            )
          )
        )
        await expect(
          require('../GithubHelper').getChangedPRFiles(
            env.octokitMock,
            'trilom/file-changes-action',
            'unknown',
            'unknown'
          )
        ).rejects.toThrowError(
          new Error(
            JSON.stringify(
              {
                error: '500/Unknown Error:',
                from: 'getChangedPRFiles',
                message:
                  'There was an error getting change files for repo:trilom/file-changes-action owner:unknown pr:unknown',
                payload: ''
              },
              null,
              2
            )
          )
        )
      })
    })
    /**
     * @function getChangedPushFiles
     */
    describe('...with function getChangedPushFiles...', () => {
      it.each(getTestEvents(p.getChangedPushFilesTestInputs, event))(
        '...%s',
        async (title, input, expected) => {
          if (title.includes('throws an error')) {
            expect.assertions(1)
            await expect(
              require('../GithubHelper').getChangedPushFiles(
                env.octokitMock,
                input.repo,
                input.owner,
                input.before,
                input.after
              )
            ).rejects.toThrowError(new Error(JSON.stringify(expected, null, 2)))
          } else {
            let files: any[] = []
            files = await require('../GithubHelper').getChangedPushFiles(
              env.octokitMock,
              input.repo,
              input.owner,
              input.before,
              input.after
            )
            expect(files).toStrictEqual(expected)
            expect(files.length).toBe(7)
          }
        }
      )
      it('...throws errows', async () => {
        await expect(
          require('../GithubHelper').getChangedPushFiles(
            env.octokitMock,
            'trilom/file-changes-action',
            'error',
            'error',
            'error'
          )
        ).rejects.toThrowError(
          new Error(
            JSON.stringify(
              {
                error: '500/Unknown Error:Error',
                from: 'getChangedPushFiles',
                message:
                  'There was an error getting change files for repo:trilom/file-changes-action owner:error base:error head:error',
                payload: JSON.stringify({name: 'HttpError', status: '500'})
              },
              null,
              2
            )
          )
        )
        await expect(
          require('../GithubHelper').getChangedPushFiles(
            env.octokitMock,
            'trilom/file-changes-action',
            'unknown',
            'unknown',
            'unknown'
          )
        ).rejects.toThrowError(
          new Error(
            JSON.stringify(
              {
                error: '500/Unknown Error:',
                from: 'getChangedPushFiles',
                message:
                  'There was an error getting change files for repo:trilom/file-changes-action owner:unknown base:unknown head:unknown',
                payload: ''
              },
              null,
              2
            )
          )
        )
      })
    })
    /**
     * @function getChangedFiles
     */
    describe('...with function getChangedFiles...', () => {
      it.each(getTestEvents(p.getChangedFilesTestInputs, event))(
        '...%s',
        async (title, input, expected) => {
          if (title.includes('throws an error')) {
            expect.assertions(1)
            await expect(
              require('../GithubHelper').getChangedFiles(
                env.octokitMock,
                input.repo,
                {...input}
              )
            ).rejects.toThrowError(new Error(JSON.stringify(expected, null, 2)))
          } else {
            let files: any[] = []
            files = await require('../GithubHelper').getChangedFiles(
              env.octokitMock,
              input.repo,
              {...input}
            )
            expect(files).toStrictEqual(expected)
            expect(files.length).toBe(7)
          }
        }
      )
    })
  })
})
