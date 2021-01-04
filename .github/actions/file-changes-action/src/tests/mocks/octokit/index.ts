import {EndpointOptions, OctokitResponse} from '@octokit/types'
import {OctokitMock} from 'typings/OctokitMock'
// mock endpoints
import {fn as endpointMerge} from './endpoint/merge'
import {fn as paginate} from './paginate'
import {fn as listFiles} from './pulls/listFiles'
import {fn as compareCommits} from './repos/compareCommits'

// new object
export const octokitMock: OctokitMock = {
  paginate: (
    data: EndpointOptions,
    cb?: (response: OctokitResponse<any>) => Promise<any[]>
  ) => paginate(data, cb),
  pulls: {
    listFiles: Object.assign((data: EndpointOptions) => listFiles(data), {
      endpoint: {
        merge: (data: EndpointOptions) => endpointMerge(data)
      }
    })
  },
  repos: {
    compareCommits: Object.assign(
      (data: EndpointOptions) => compareCommits(data),
      {
        endpoint: {
          merge: (data: EndpointOptions) => endpointMerge(data)
        }
      }
    )
  }
}
