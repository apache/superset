import {octokitMock} from '.'

describe('Testing Octokit object ...', () => {
  beforeAll(() => jest.restoreAllMocks())
  it('...Octokit is a mock', () => {
    expect(octokitMock).toHaveProperty('paginate')
    expect(octokitMock).toHaveProperty('pulls')
    expect(octokitMock).toHaveProperty('repos')
    expect(octokitMock).not.toHaveProperty('actions')
  })
})
