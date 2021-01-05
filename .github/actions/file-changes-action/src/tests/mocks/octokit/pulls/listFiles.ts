// Import Request and Response Objects
import {EndpointOptions, OctokitResponse} from '@octokit/types'
import {
  // OctokitPullsListFilesRequest,
  OctokitPullsListFilesResponse
} from '../payloads'
// Form and export Response Objects
export {OctokitPullsListFilesResponse as response}
// Export mock function
export const fn = jest.fn((data: EndpointOptions) => {
  return Promise.resolve({
    data: OctokitPullsListFilesResponse
  } as OctokitResponse<any>)
})
