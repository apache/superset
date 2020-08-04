// @flow

export type StylisPlugin = (
  context: -2 | -1 | 0 | 1 | 2 | 3,
  content: string,
  selectors: Array<string>,
  parents: Array<string>,
  line: number,
  column: number,
  length: number,
  at: number,
  depth: number
) => mixed
