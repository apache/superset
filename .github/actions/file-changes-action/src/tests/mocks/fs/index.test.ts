import {mock} from '.'

const fs = mock()

describe('Testing FsMock object...', () => {
  beforeAll(() => jest.restoreAllMocks())
  it('...FsMock is a mock', () => {
    expect(jest.isMockFunction(fs.writeFileSync)).toBe(true)
  })
  it('...FsMock mocks fs', () => {
    const realFs = require('fs')
    expect(fs).toMatchObject(realFs)
  })
  it('...FsMock mocks writeFileSync', () => {
    fs.writeFileSync('a', 'b', 'c')
    expect(fs.writeFileSync).toBeCalledWith('a', 'b', 'c')
  })
  it('...FsMock mocks an error', async () => {
    expect(() => fs.writeFileSync('error', 'b', 'c')).toThrowError(
      new Error(JSON.stringify({name: 'PathError', status: '500'}))
    )
  })
})
