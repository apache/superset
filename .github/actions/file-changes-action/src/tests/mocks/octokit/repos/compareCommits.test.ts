import {fn as compareCommits} from './compareCommits'
import {
  OctokitReposCompareCommitsRequest,
  OctokitReposCompareCommitsResponse
} from '../payloads'

describe('Testing Octokit object...', () => {
  beforeAll(() => {
    jest.restoreAllMocks()
  })
  it('...repos.compareCommits(request) for push', () => {
    const request = OctokitReposCompareCommitsRequest
    const response = OctokitReposCompareCommitsResponse
    return compareCommits(request).then(data => {
      expect(data.data.files).toBe(response)
      return expect(data.data.files.length).toBe(7)
    })
  })
})
