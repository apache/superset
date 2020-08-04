// @flow
import { StyleSheet } from '@emotion/sheet'
import { type EmotionCache, type SerializedStyles } from '@emotion/utils'
import Stylis from '@emotion/stylis'
import weakMemoize from '@emotion/weak-memoize'
import { Sheet, removeLabel, ruleSheet } from './stylis-plugins'
import type { StylisPlugin } from './types'

let isBrowser = typeof document !== 'undefined'

export type PrefixOption =
  | boolean
  | ((key: string, value: string, context: 1 | 2 | 3) => boolean)
type StylisPlugins = StylisPlugin[] | StylisPlugin

export type Options = {
  nonce?: string,
  stylisPlugins?: StylisPlugins,
  prefix?: PrefixOption,
  key?: string,
  container?: HTMLElement,
  speedy?: boolean
}

let rootServerStylisCache = {}

let getServerStylisCache = isBrowser
  ? undefined
  : weakMemoize(() => {
      let getCache = weakMemoize(() => ({}))
      let prefixTrueCache = {}
      let prefixFalseCache = {}
      return prefix => {
        if (prefix === undefined || prefix === true) {
          return prefixTrueCache
        }
        if (prefix === false) {
          return prefixFalseCache
        }
        return getCache(prefix)
      }
    })

let createCache = (options?: Options): EmotionCache => {
  if (options === undefined) options = {}
  let key = options.key || 'css'
  let stylisOptions

  if (options.prefix !== undefined) {
    stylisOptions = {
      prefix: options.prefix
    }
  }

  let stylis = new Stylis(stylisOptions)

  if (process.env.NODE_ENV !== 'production') {
    // $FlowFixMe
    if (/[^a-z-]/.test(key)) {
      throw new Error(
        `Emotion key must only contain lower case alphabetical characters and - but "${key}" was passed`
      )
    }
  }
  let inserted = {}
  // $FlowFixMe
  let container: HTMLElement
  if (isBrowser) {
    container = options.container || document.head

    const nodes = document.querySelectorAll(`style[data-emotion-${key}]`)

    Array.prototype.forEach.call(nodes, (node: HTMLStyleElement) => {
      const attrib = node.getAttribute(`data-emotion-${key}`)
      // $FlowFixMe
      attrib.split(' ').forEach(id => {
        inserted[id] = true
      })
      if (node.parentNode !== container) {
        container.appendChild(node)
      }
    })
  }

  let insert: (
    selector: string,
    serialized: SerializedStyles,
    sheet: StyleSheet,
    shouldCache: boolean
  ) => string | void

  if (isBrowser) {
    stylis.use(options.stylisPlugins)(ruleSheet)

    insert = (
      selector: string,
      serialized: SerializedStyles,
      sheet: StyleSheet,
      shouldCache: boolean
    ): void => {
      let name = serialized.name
      Sheet.current = sheet
      if (
        process.env.NODE_ENV !== 'production' &&
        serialized.map !== undefined
      ) {
        let map = serialized.map
        Sheet.current = {
          insert: (rule: string) => {
            sheet.insert(rule + map)
          }
        }
      }
      stylis(selector, serialized.styles)
      if (shouldCache) {
        cache.inserted[name] = true
      }
    }
  } else {
    stylis.use(removeLabel)
    let serverStylisCache = rootServerStylisCache
    if (options.stylisPlugins || options.prefix !== undefined) {
      stylis.use(options.stylisPlugins)
      // $FlowFixMe
      serverStylisCache = getServerStylisCache(
        options.stylisPlugins || rootServerStylisCache
      )(options.prefix)
    }
    let getRules = (selector: string, serialized: SerializedStyles): string => {
      let name = serialized.name
      if (serverStylisCache[name] === undefined) {
        serverStylisCache[name] = stylis(selector, serialized.styles)
      }
      return serverStylisCache[name]
    }
    insert = (
      selector: string,
      serialized: SerializedStyles,
      sheet: StyleSheet,
      shouldCache: boolean
    ): string | void => {
      let name = serialized.name
      let rules = getRules(selector, serialized)
      if (cache.compat === undefined) {
        // in regular mode, we don't set the styles on the inserted cache
        // since we don't need to and that would be wasting memory
        // we return them so that they are rendered in a style tag
        if (shouldCache) {
          cache.inserted[name] = true
        }
        if (
          // using === development instead of !== production
          // because if people do ssr in tests, the source maps showing up would be annoying
          process.env.NODE_ENV === 'development' &&
          serialized.map !== undefined
        ) {
          return rules + serialized.map
        }
        return rules
      } else {
        // in compat mode, we put the styles on the inserted cache so
        // that emotion-server can pull out the styles
        // except when we don't want to cache it which was in Global but now
        // is nowhere but we don't want to do a major right now
        // and just in case we're going to leave the case here
        // it's also not affecting client side bundle size
        // so it's really not a big deal

        if (shouldCache) {
          cache.inserted[name] = rules
        } else {
          return rules
        }
      }
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    // https://esbench.com/bench/5bf7371a4cd7e6009ef61d0a
    const commentStart = /\/\*/g
    const commentEnd = /\*\//g

    stylis.use((context, content) => {
      switch (context) {
        case -1: {
          while (commentStart.test(content)) {
            commentEnd.lastIndex = commentStart.lastIndex

            if (commentEnd.test(content)) {
              commentStart.lastIndex = commentEnd.lastIndex
              continue
            }

            throw new Error(
              'Your styles have an unterminated comment ("/*" without corresponding "*/").'
            )
          }

          commentStart.lastIndex = 0
          break
        }
      }
    })

    stylis.use((context, content, selectors) => {
      switch (context) {
        case -1: {
          const flag =
            'emotion-disable-server-rendering-unsafe-selector-warning-please-do-not-use-this-the-warning-exists-for-a-reason'
          const unsafePseudoClasses = content.match(
            /(:first|:nth|:nth-last)-child/g
          )

          if (unsafePseudoClasses && cache.compat !== true) {
            unsafePseudoClasses.forEach(unsafePseudoClass => {
              const ignoreRegExp = new RegExp(
                `${unsafePseudoClass}.*\\/\\* ${flag} \\*\\/`
              )
              const ignore = ignoreRegExp.test(content)

              if (unsafePseudoClass && !ignore) {
                console.error(
                  `The pseudo class "${unsafePseudoClass}" is potentially unsafe when doing server-side rendering. Try changing it to "${
                    unsafePseudoClass.split('-child')[0]
                  }-of-type".`
                )
              }
            })
          }

          break
        }
      }
    })
  }

  const cache: EmotionCache = {
    key,
    sheet: new StyleSheet({
      key,
      container,
      nonce: options.nonce,
      speedy: options.speedy
    }),
    nonce: options.nonce,
    inserted,
    registered: {},
    insert
  }
  return cache
}

export default createCache
