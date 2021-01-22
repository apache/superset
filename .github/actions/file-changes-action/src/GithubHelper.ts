import {GitHub} from '@actions/github'
import {GitHubFile} from 'typings/GitHubFile'
import {Inferred} from 'typings/Inferred'
import {getErrorString} from './UtilsHelper'
/**
 * @function initClient
 * @throws {Error} not sure what might trigger this, but it will throw an error.
 * @param token github token to add to client
 * @returns authenticated github client
 */
export function initClient(token: string): GitHub {
  try {
    return new GitHub(token)
  } catch (error) {
    const eString = `There was an error creating github client. Please check your token.`
    throw new Error(
      getErrorString(error.name, error.status, initClient.name, eString, error)
    )
  }
}
/**
 * @function getChangedPRFiles
 * @throws {Error} when a 404 or other is received.  404 can be bad repo, owner, pr, or unauthenticated
 * @param client authenticated github client (possibly un-authenticated if public)
 * @param repo  repo string. file-changes-action
 * @param owner owner string.  trilom
 * @param pullNumber pr number to get changed files for
 * @returns Promise of array of changed files
 */
export async function getChangedPRFiles(
  client: GitHub,
  repo: string,
  owner: string,
  pullNumber: number
): Promise<GitHubFile[]> {
  try {
    const options = client.pulls.listFiles.endpoint.merge({
      owner,
      repo,
      pull_number: pullNumber
    })
    const files: GitHubFile[] = await client.paginate(
      options,
      response => response.data
    )
    return files
  } catch (error) {
    const eString = `There was an error getting change files for repo:${repo} owner:${owner} pr:${pullNumber}`
    let ePayload: string
    if (error.name === 'HttpError' && +error.status === 404)
      ePayload = getErrorString(
        error.name,
        error.status,
        getChangedPRFiles.name,
        eString,
        error
      )
    else
      ePayload = getErrorString(
        `Unknown Error:${error.name || ''}`,
        error.status,
        getChangedPRFiles.name,
        eString,
        error.message
      )
    throw new Error(ePayload)
  }
}
/**
 * @function getChangedPushFiles
 * @throws {Error} when a 404 or other is received.  404 can be bad repo, owner, sha, or unauthenticated
 * @param client authenticated github client (possibly un-authenticated if public)
 * @param repo  repo string. file-changes-action
 * @param owner owner string.  trilom
 * @param base BASE commit sha to compare
 * @param head HEAD commit sha to compare
 * @returns Promise of array of changed files
 */
export async function getChangedPushFiles(
  client: GitHub,
  repo: string,
  owner: string,
  base: string,
  head: string
): Promise<GitHubFile[]> {
  try {
    const options = client.repos.compareCommits.endpoint.merge({
      owner,
      repo,
      base,
      head
    })
    const files: GitHubFile[] = await client.paginate(
      options,
      response => response.data.files
    )
    return files
  } catch (error) {
    const eString = `There was an error getting change files for repo:${repo} owner:${owner} base:${base} head:${head}`
    let ePayload: string
    if (error.name === 'HttpError' && +error.status === 404)
      ePayload = getErrorString(
        error.name,
        error.status,
        getChangedPushFiles.name,
        eString,
        error
      )
    else
      ePayload = getErrorString(
        `Unknown Error:${error.name || ''}`,
        error.status,
        getChangedPushFiles.name,
        eString,
        error.message
      )
    throw new Error(ePayload)
  }
}
/**
 * @function getChangedFiles
 * @param client client authenticated github client (possibly un-authenticated if public)
 * @param repoFull repo owner/repo string.  trilom/file-changes-action
 * @type {Inferred} pass in iinferred type from inferInput
 * @returns Promise of an array of changed PR or push files
 */
export async function getChangedFiles(
  client: GitHub,
  repoFull: string,
  {before, after, pr = NaN}: Inferred
): Promise<GitHubFile[]> {
  try {
    if (repoFull.split('/').length > 2) {
      throw new Error(
        getErrorString(
          `Bad-Repo`,
          500,
          'self',
          `Repo input of ${repoFull} has more than 2 length after splitting.`
        )
      )
    }
    const owner = repoFull.split('/')[0]
    const repo = repoFull.split('/')[1]
    let files: GitHubFile[] = []
    if (Number.isNaN(pr))
      files = await getChangedPushFiles(
        client,
        repo,
        owner,
        before || '',
        after || ''
      )
    else files = await getChangedPRFiles(client, repo, owner, pr)
    return files
  } catch (error) {
    const pError = JSON.parse(error.message)
    if (pError.from.includes('getChanged'))
      throw new Error(
        JSON.stringify(
          {...pError, ...{from: `${error.status}/${error.name}`}},
          null,
          2
        )
      )
    const eString = `There was an error getting change files outputs pr: ${pr} before: ${before} after: ${after}`
    const ePayload: string = getErrorString(
      `Unknown Error:${error.name}`,
      error.status,
      getChangedFiles.name,
      eString,
      error.message
    )
    throw new Error(ePayload)
  }
}
