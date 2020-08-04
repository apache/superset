// Definitions by: Junyoung Clare Jang <https://github.com/Ailrun>
// TypeScript Version: 2.2
import { Plugin as StylisPlugin, Prefix } from '@emotion/stylis'
import { EmotionCache } from '@emotion/utils'

export { StylisPlugin, Prefix, EmotionCache }

export interface Options {
  nonce?: string
  stylisPlugins?: StylisPlugin | Array<StylisPlugin>
  prefix?: Prefix
  key?: string
  container?: HTMLElement
  speedy?: boolean
}

export default function createCache(options?: Options): EmotionCache
