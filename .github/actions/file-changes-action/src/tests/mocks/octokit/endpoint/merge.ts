// Import Request and Response Objects
import {EndpointOptions, RequestOptions} from '@octokit/types'
import {
  // OctokitReposCompareCommitsEndpointMergeRequest,
  OctokitReposCompareCommitsEndpointMergeResponse,
  // OctokitPullsListFilesEndpointMergeRequest,
  OctokitPullsListFilesEndpointMergeResponse
} from '../payloads'
// Form and export Response Objects
export {OctokitReposCompareCommitsEndpointMergeResponse as pushResponse}
export {OctokitPullsListFilesEndpointMergeResponse as prResponse}
// Export mock function
export const fn = jest.fn((data: EndpointOptions, response?: number) => {
  if (data.base === 'error' || data.pull_number === 'error') {
    throw new Error(JSON.stringify({name: 'HttpError', status: '500'}))
  }
  if (data.base === 'unknown' || data.pull_number === 'unknown') {
    throw JSON.stringify({idk: 'error', message: 'test'})
  }
  if (
    (!data.base && !data.head && Number.isNaN(data.pull_number)) ||
    (!data.base && data.head) ||
    (data.base && !data.head)
  )
    return {
      ...OctokitPullsListFilesEndpointMergeResponse,
      ...{pull_number: NaN, base: '', head: ''}
    } as RequestOptions
  if (data.pull_number) {
    return {
      ...OctokitPullsListFilesEndpointMergeResponse,
      ...data
    } as RequestOptions
  }
  return {
    ...OctokitReposCompareCommitsEndpointMergeResponse,
    ...data
  } as RequestOptions
})
