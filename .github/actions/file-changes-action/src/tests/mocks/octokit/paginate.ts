// Import Request and Response Objects
import {EndpointOptions, OctokitResponse} from '@octokit/types'
import {
  // OctokitPaginatePrRequest,
  OctokitPaginatePrResponse,
  // OctokitPaginatePushRequest,
  OctokitPaginatePushResponse
} from './payloads'

// Form and export Response Objects
export const prResponse = OctokitPaginatePrResponse
export const pushResponse = {files: OctokitPaginatePushResponse}
// Export mock function
export const fn = jest.fn(
  (
    data: EndpointOptions,
    cb?: (response: OctokitResponse<any>) => Promise<any[]>
  ) => {
    if (
      data.owner !== 'trilom' ||
      data.repo !== 'file-changes-action' ||
      (data.base && !data.head) ||
      (!data.base && data.head) ||
      // the github api doesn't seem to return an error
      // eslint-disable-next-line prefer-promise-reject-errors
      (!data.base && !data.head && !data.pull_number)
    )
      // eslint-disable-next-line prefer-promise-reject-errors
      return Promise.reject({name: 'HttpError', status: '404'})
    if (data.pull_number) {
      if (cb)
        return Promise.resolve(cb({data: prResponse} as OctokitResponse<any>))
      return Promise.resolve(prResponse)
    }
    if (cb)
      return Promise.resolve(cb({data: pushResponse} as OctokitResponse<any>))
    return Promise.resolve([pushResponse])
  }
)
