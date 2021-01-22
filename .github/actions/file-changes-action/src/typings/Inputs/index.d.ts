export interface Inputs {
  githubRepo: string
  githubToken: string
  pushBefore: string
  pushAfter: string
  prNumber: number
  output: string
  fileOutput: string
  event: string
  [key: string]: string | number
}
