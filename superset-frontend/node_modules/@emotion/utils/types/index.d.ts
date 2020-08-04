// Definitions by: Junyoung Clare Jang <https://github.com/Ailrun>
// TypeScript Version: 2.2

export interface RegisteredCache {
  [key: string]: string
}

export interface StyleSheet {
  container: HTMLElement
  nonce?: string
  key: string
  insert(rule: string): void
  flush(): void
  tags: Array<HTMLStyleElement>
}

export interface EmotionCache {
  stylis(key: string, value: string): Array<string>
  inserted: {
    [key: string]: string | true
  }
  registered: RegisteredCache
  sheet: StyleSheet
  key: string
  compat?: true
  nonce?: string
}

export interface SerializedStyles {
  name: string
  styles: string
  map?: string
  next?: SerializedStyles
}

export const isBrowser: boolean
export function getRegisteredStyles(
  registered: RegisteredCache,
  registeredStyles: Array<string>,
  classNames: string
): string
export function insertStyles(
  cache: EmotionCache,
  serialized: SerializedStyles,
  isStringTag: boolean
): string | void
