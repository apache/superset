export interface FsMock {
  writeFileSync: (
    path: string | number | Buffer | URL,
    data: any,
    options?:
      | string
      | {
          encoding?: string | null | undefined
          mode?: string | number | undefined
          flag?: string | undefined
        }
      | null
      | undefined
  ) => void
}
