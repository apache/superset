import {fn as listFiles} from './listFiles'
import {
  OctokitPullsListFilesRequest,
  OctokitPullsListFilesResponse
} from '../payloads'

describe('Testing Octokit object...', () => {
  beforeAll(() => {
    jest.restoreAllMocks()
  })
  it('...pulls.listFiles(request) for pull request', () => {
    const request = OctokitPullsListFilesRequest
    const response = OctokitPullsListFilesResponse
    return listFiles(request).then(data => {
      expect(data.data).toBe(response)
      return expect(data.data.length).toBe(7)
    })
  })
})
