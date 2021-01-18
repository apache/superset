import {Context} from '@actions/github/lib/context'
import {GitHubMock} from 'typings/GitHubMock'
import {OctokitMock} from 'typings/OctokitMock'
import {octokitMock} from '../octokit'

function getGitHubMock(context: Context): GitHubMock {
  return {
    GitHub: jest.fn(token => {
      // console.log(`I am authorizing GitHub with token: ${token}`)
      if (!token)
        throw new Error(
          JSON.stringify({name: 'GithubInitError', status: '500'})
        )
      return octokitMock
    }),
    context
  }
}

export function mock(): {
  github: GitHubMock
  octokit: OctokitMock
  context: Context
} {
  const context = new Context()
  const github = getGitHubMock(context)
  jest.mock('@actions/github', () => github)
  return {github, octokit: octokitMock, context}
}
