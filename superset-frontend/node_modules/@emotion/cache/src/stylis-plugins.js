// @flow
// https://github.com/thysultan/stylis.js/tree/master/plugins/rule-sheet
// inlined to avoid umd wrapper and peerDep warnings/installing stylis
// since we use stylis after closure compiler

import type { StylisPlugin } from './types'

const delimiter = '/*|*/'
const needle = delimiter + '}'

function toSheet(block) {
  if (block) {
    Sheet.current.insert(block + '}')
  }
}

export let Sheet: { current: { +insert: string => void } } = {
  current: (null: any)
}

export let ruleSheet: StylisPlugin = (
  context,
  content,
  selectors,
  parents,
  line,
  column,
  length,
  ns,
  depth,
  at
) => {
  switch (context) {
    // property
    case 1: {
      switch (content.charCodeAt(0)) {
        case 64: {
          // @import
          Sheet.current.insert(content + ';')
          return ''
        }
        // charcode for l
        case 108: {
          // charcode for b
          // this ignores label
          if (content.charCodeAt(2) === 98) {
            return ''
          }
        }
      }
      break
    }
    // selector
    case 2: {
      if (ns === 0) return content + delimiter
      break
    }
    // at-rule
    case 3: {
      switch (ns) {
        // @font-face, @page
        case 102:
        case 112: {
          Sheet.current.insert(selectors[0] + content)
          return ''
        }
        default: {
          return content + (at === 0 ? delimiter : '')
        }
      }
    }
    case -2: {
      content.split(needle).forEach(toSheet)
    }
  }
}

export let removeLabel: StylisPlugin = (context, content) => {
  if (
    context === 1 &&
    // charcode for l
    content.charCodeAt(0) === 108 &&
    // charcode for b
    content.charCodeAt(2) === 98
    // this ignores label
  ) {
    return ''
  }
}
