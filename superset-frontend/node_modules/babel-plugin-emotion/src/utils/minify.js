// @flow
import { minify } from './minify-utils'

export function getExpressionsFromTemplateLiteral(node: *, t: *): Array<*> {
  const raw = createRawStringFromTemplateLiteral(node)
  const minified = minify(raw)
  return replacePlaceholdersWithExpressions(minified, node.expressions || [], t)
}

const interleave = (strings: Array<*>, interpolations: Array<*>) =>
  interpolations.reduce(
    (array, interp, i) => array.concat([interp], strings[i + 1]),
    [strings[0]]
  )

function getDynamicMatches(str: string) {
  const re = /xxx(\d+)xxx/gm
  let match
  const matches = []
  while ((match = re.exec(str)) !== null) {
    // so that flow doesn't complain
    if (match !== null) {
      matches.push({
        value: match[0],
        p1: parseInt(match[1], 10),
        index: match.index
      })
    }
  }

  return matches
}

function replacePlaceholdersWithExpressions(
  str: string,
  expressions: Array<*>,
  t: *
) {
  const matches = getDynamicMatches(str)
  if (matches.length === 0) {
    if (str === '') {
      return []
    }
    return [t.stringLiteral(str)]
  }
  const strings = []
  const finalExpressions = []
  let cursor = 0

  matches.forEach(({ value, p1, index }, i) => {
    const preMatch = str.substring(cursor, index)
    cursor = cursor + preMatch.length + value.length
    if (preMatch) {
      strings.push(t.stringLiteral(preMatch))
    } else if (i === 0) {
      strings.push(t.stringLiteral(''))
    }

    finalExpressions.push(expressions[p1])
    if (i === matches.length - 1) {
      strings.push(t.stringLiteral(str.substring(index + value.length)))
    }
  })

  return interleave(strings, finalExpressions).filter(
    (node: { value: string }) => {
      return node.value !== ''
    }
  )
}

function createRawStringFromTemplateLiteral(quasi: {
  quasis: Array<{ value: { cooked: string } }>
}) {
  let strs = quasi.quasis.map(x => x.value.cooked)

  const src = strs
    .reduce((arr, str, i) => {
      arr.push(str)
      if (i !== strs.length - 1) {
        arr.push(`xxx${i}xxx`)
      }
      return arr
    }, [])
    .join('')
    .trim()
  return src
}
