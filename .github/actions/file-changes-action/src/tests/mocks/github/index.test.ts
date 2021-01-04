import {Context} from '@actions/github/lib/context'
import {mock} from '.'
import {octokitMock} from '../octokit'

const github = mock()

describe('Testing GitHubMock object ...', () => {
  beforeAll(() => jest.restoreAllMocks())
  it('...GitHubMock is a mock', () => {
    expect(jest.isMockFunction(github.github.GitHub)).toBe(true)
    expect(github.context).toMatchObject(new Context())
  })
  it('...GitHubMock mocks GitHub', () => {
    const {GitHub} = require('@actions/github')
    const mockGitHub = GitHub('test')
    expect(mockGitHub).toMatchObject(octokitMock)
  })
  it('...GitHubMock mocks unauthorized GitHub', () => {
    const GitHub = mock()
    expect(jest.isMockFunction(GitHub.github.GitHub)).toBe(true)
  })
  it('...GitHubMock mocks authorizing GitHub', () => {
    const GitHub = mock()
    const octokit = GitHub.github.GitHub('token')
    expect(jest.isMockFunction(GitHub.github.GitHub)).toBe(true)
    expect(GitHub.github.GitHub).toBeCalledWith('token')
    expect(octokit).toMatchObject(octokitMock)
  })
})
