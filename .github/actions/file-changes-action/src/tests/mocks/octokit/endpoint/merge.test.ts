import {EndpointOptions} from '@octokit/types'
import {fn as merge} from './merge'
import {
  OctokitPullsListFilesEndpointMergeRequest,
  OctokitPullsListFilesEndpointMergeResponse,
  OctokitReposCompareCommitsEndpointMergeRequest,
  OctokitReposCompareCommitsEndpointMergeResponse
} from '../payloads'

describe('Testing Octokit object...', () => {
  beforeAll(() => {
    jest.restoreAllMocks()
  })
  it('...endpoint.merge returns 500 error with pull_number "error"', () => {
    expect(() => {
      merge(({pull_number: 'error'} as unknown) as EndpointOptions)
    }).toThrowError(
      new Error(JSON.stringify({name: 'HttpError', status: '500'}))
    )
  })
  it('...endpoint.merge returns 500 error with base "error"', () => {
    expect(() => {
      merge(({base: 'error'} as unknown) as EndpointOptions)
    }).toThrowError(
      new Error(JSON.stringify({name: 'HttpError', status: '500'}))
    )
  })
  it('...endpoint.merge returns empty object', async () => {
    const request = OctokitPullsListFilesEndpointMergeRequest
    const data = merge({...request, pull_number: NaN})
    expect(data).toStrictEqual({
      ...OctokitPullsListFilesEndpointMergeResponse,
      ...{pull_number: NaN, base: '', head: ''}
    })
  })
  it('...endpoint.merge for pull request', () => {
    const request = OctokitPullsListFilesEndpointMergeRequest
    const response = OctokitPullsListFilesEndpointMergeResponse
    const data = merge(request)
    expect(data).toStrictEqual(response)
  })
  it('...endpoint.merge for push', () => {
    const request = OctokitReposCompareCommitsEndpointMergeRequest
    const response = OctokitReposCompareCommitsEndpointMergeResponse
    const data = merge(request)
    expect(data).toStrictEqual(response)
  })
})
