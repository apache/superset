import {Env, p, getTestEvents} from './mocks/env'

let env: Env
describe('Testing UtilsHelper.ts...', () => {
  describe('...with push event...', () => {
    beforeAll(() => {
      env = new Env({}, {githubToken: 'TestToken'}, 'push')
    })
    afterEach(() => {
      process.env = {...env.envStart}
      jest.resetModules()
      env = new Env({}, {}, 'push')
    })
    /**
     * @function getErrorString
     */
    describe('...with function getErrorString...', () => {
      it('...can throw an error', () => {
        const error = require('../UtilsHelper').getErrorString()
        expect(JSON.stringify(JSON.parse(error))).toBe(
          JSON.stringify({error: '500/undefined', payload: ''})
        )
      })

      it('...can throw an error for my error', () => {
        const {setFailed, error: coreError} = require('@actions/core')
        const obj = {a: {}}
        obj.a = {b: obj}
        expect(() =>
          require('../UtilsHelper').getErrorString(
            'test',
            200,
            'test',
            'test',
            obj
          )
        ).toThrowError(
          JSON.stringify({
            name: '500/undefined',
            message: 'Error throwing error.'
          })
        )
        // expect(JSON.stringify(JSON.parse(error))).toBe(JSON.stringify({error:'500/undefined', payload:''}))
        expect(setFailed).toBeCalledWith(
          expect.stringContaining('Error throwing error.')
        )
        expect(coreError).toBeCalledWith(
          expect.stringContaining('Error throwing error.')
        )
      })
    })
    /**
     * @function errorMessage
     */
    describe('...with function errorMessage...', () => {
      it.each(getTestEvents(p.errorMessageInputs, 'push'))(
        '...for function %s',
        (f, e, expected) => {
          const error = require('../UtilsHelper').errorMessage(f, e)
          expect(error).toBe(
            `${expected}\nException: ${JSON.stringify(e, null, 2)}`
          )
        }
      )
    })
  })
})
