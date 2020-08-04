// @flow
/*

Based off glamor's StyleSheet, thanks Sunil ❤️

high performance StyleSheet for css-in-js systems

- uses multiple style tags behind the scenes for millions of rules
- uses `insertRule` for appending in production for *much* faster performance

// usage

import { StyleSheet } from '@emotion/sheet'

let styleSheet = new StyleSheet({ key: '', container: document.head })

styleSheet.insert('#box { border: 1px solid red; }')
- appends a css rule into the stylesheet

styleSheet.flush()
- empties the stylesheet of all its contents

*/

// $FlowFixMe
function sheetForTag(tag: HTMLStyleElement): CSSStyleSheet {
  if (tag.sheet) {
    // $FlowFixMe
    return tag.sheet
  }

  // this weirdness brought to you by firefox
  /* istanbul ignore next */
  for (let i = 0; i < document.styleSheets.length; i++) {
    if (document.styleSheets[i].ownerNode === tag) {
      // $FlowFixMe
      return document.styleSheets[i]
    }
  }
}

export type Options = {
  nonce?: string,
  key: string,
  container: HTMLElement,
  speedy?: boolean
}

function createStyleElement(options: {
  key: string,
  nonce: string | void
}): HTMLStyleElement {
  let tag = document.createElement('style')
  tag.setAttribute('data-emotion', options.key)
  if (options.nonce !== undefined) {
    tag.setAttribute('nonce', options.nonce)
  }
  tag.appendChild(document.createTextNode(''))
  return tag
}

export class StyleSheet {
  isSpeedy: boolean
  ctr: number
  tags: HTMLStyleElement[]
  container: HTMLElement
  key: string
  nonce: string | void
  before: Element | null
  constructor(options: Options) {
    this.isSpeedy =
      options.speedy === undefined
        ? process.env.NODE_ENV === 'production'
        : options.speedy
    this.tags = []
    this.ctr = 0
    this.nonce = options.nonce
    // key is the value of the data-emotion attribute, it's used to identify different sheets
    this.key = options.key
    this.container = options.container
    this.before = null
  }
  insert(rule: string) {
    // the max length is how many rules we have per style tag, it's 65000 in speedy mode
    // it's 1 in dev because we insert source maps that map a single rule to a location
    // and you can only have one source map per style tag
    if (this.ctr % (this.isSpeedy ? 65000 : 1) === 0) {
      let tag = createStyleElement(this)
      let before
      if (this.tags.length === 0) {
        before = this.before
      } else {
        before = this.tags[this.tags.length - 1].nextSibling
      }
      this.container.insertBefore(tag, before)
      this.tags.push(tag)
    }
    const tag = this.tags[this.tags.length - 1]

    if (this.isSpeedy) {
      const sheet = sheetForTag(tag)
      try {
        // this is a really hot path
        // we check the second character first because having "i"
        // as the second character will happen less often than
        // having "@" as the first character
        let isImportRule =
          rule.charCodeAt(1) === 105 && rule.charCodeAt(0) === 64
        // this is the ultrafast version, works across browsers
        // the big drawback is that the css won't be editable in devtools
        sheet.insertRule(
          rule,
          // we need to insert @import rules before anything else
          // otherwise there will be an error
          // technically this means that the @import rules will
          // _usually_(not always since there could be multiple style tags)
          // be the first ones in prod and generally later in dev
          // this shouldn't really matter in the real world though
          // @import is generally only used for font faces from google fonts and etc.
          // so while this could be technically correct then it would be slower and larger
          // for a tiny bit of correctness that won't matter in the real world
          isImportRule ? 0 : sheet.cssRules.length
        )
      } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            `There was a problem inserting the following rule: "${rule}"`,
            e
          )
        }
      }
    } else {
      tag.appendChild(document.createTextNode(rule))
    }
    this.ctr++
  }
  flush() {
    // $FlowFixMe
    this.tags.forEach(tag => tag.parentNode.removeChild(tag))
    this.tags = []
    this.ctr = 0
  }
}
