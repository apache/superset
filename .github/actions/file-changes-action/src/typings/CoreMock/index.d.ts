import {InputOptions} from '@actions/core'

export interface CoreMock {
  setFailed: (message: string) => void
  setOutput: (name: string, value: string) => void
  getInput: (message: string, options?: InputOptions) => string | undefined
  debug: (message: string) => void
  warning: (message: string) => void
  info: (message: string) => void
  error: (message: string) => void
}
