/* global describe, it, afterEach */
import { expect } from 'chai'
import register, * as ignoreStyles from '../ignore-styles'

describe('ignore-styles', () => {
  afterEach(() => {
    ignoreStyles.oldHandlers = {}
  })

  describe('register()', () => {
    afterEach(() => {
      delete require.extensions['.blargh']
    })

    it('adds a no-op function as the handler for the given extensions', () => {
      register(['.blargh'])
      expect(require.extensions['.blargh']).to.equal(ignoreStyles.noOp)
    })

    it('saves the old handler so that it can be restored later', () => {
      register(['.blargh'])
      expect(ignoreStyles.oldHandlers).to.have.property('.blargh', undefined)
    })

    it('allows for a custom function to be provided instead of the no-op', () => {
      const customHandler = () => ({soup: 'No soup for you!'})
      register(['.blargh'], customHandler)
      expect(require.extensions['.blargh']).to.equal(customHandler)
    })
  })

  describe('restore', () => {
    afterEach(() => {
      delete require.extensions['.fake']
    })

    it('returns the handlers back to their previous state', () => {
      function fakeHandler () {}
      require.extensions['.fake'] = fakeHandler

      register(['.fake'])
      expect(require.extensions['.fake']).to.equal(ignoreStyles.noOp)

      ignoreStyles.restore()
      expect(require.extensions['.fake']).to.equal(fakeHandler)
    })
  })
})
