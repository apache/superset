// Definitions by: Junyoung Clare Jang <https://github.com/Ailrun>
// TypeScript Version: 2.0

export interface Options {
  nonce?: string
  key: string
  container: HTMLElement
  speedy?: boolean
}

export class StyleSheet {
  isSpeedy: boolean
  ctr: number
  tags: Array<HTMLStyleElement>
  container: HTMLElement
  maxLength: number
  key: string
  nonce?: string
  before?: Element | null
  constructor(options?: Options)
  insert(rule: string): void
  flush(): void
}
