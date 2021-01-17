export interface GitHubFile {
  added: string
  modified: string
  removed: string
  renamed: string
  filename: string
  status: string
  previous_filename: string
  distinct: boolean
}
