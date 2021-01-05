import {fn as paginate} from './paginate'
import {
  OctokitPaginatePrRequest,
  OctokitPaginatePrResponse,
  OctokitPaginatePushRequest,
  OctokitPaginatePushResponse
} from './payloads'

describe('Testing Octokit object...', () => {
  beforeAll(() => {
    jest.restoreAllMocks()
  })
  it('...paginate(request) throws a 404', async () => {
    const request = OctokitPaginatePrRequest
    await expect(
      paginate({...request, pull_number: NaN})
    ).rejects.toMatchObject({name: 'HttpError', status: '404'})
  })
  it('...paginate(request) for pull request', () => {
    const request = OctokitPaginatePrRequest
    const response = OctokitPaginatePrResponse
    return paginate(request).then(data => {
      expect(data).toStrictEqual(response)
      return expect(data.length).toBe(7)
    })
  })
  it('...paginate(request, callback) for pull request', () => {
    const request = OctokitPaginatePrRequest
    const response = OctokitPaginatePrResponse
    return paginate(request, res => {
      return res.data
    }).then(data => {
      expect(data).toStrictEqual(response)
      return expect(data.length).toBe(7)
    })
  })
  it('...paginate(request) for push', async () => {
    const request = OctokitPaginatePushRequest
    const response = OctokitPaginatePushResponse
    expect.assertions(1)
    const files = await paginate(request).then(data => {
      return data.map(commit => commit.files)
    })
    expect(files).toStrictEqual([response])
  })
  it('...paginate(request, callback) for push', async () => {
    const request = OctokitPaginatePushRequest
    const response = OctokitPaginatePushResponse
    const files = await paginate(request, res => {
      return res.data.files
    })
    expect(files).toStrictEqual(response)
    expect(files.length).toBe(7)
  })
})
