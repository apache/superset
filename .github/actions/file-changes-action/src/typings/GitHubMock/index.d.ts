import {Context} from '@actions/github/lib/context'
import {OctokitMock} from 'typings/OctokitMock'

export interface GitHubMock {
  GitHub: (token: string) => OctokitMock | OctokitMock
  context: Context
}
