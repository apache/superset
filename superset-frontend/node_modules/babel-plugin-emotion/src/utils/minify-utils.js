// @flow
// babel-plugin-styled-components
// https://github.com/styled-components/babel-plugin-styled-components/blob/8d44acc36f067d60d4e09f9c22ff89695bc332d2/src/minify/index.js

const multilineCommentRegex = /\/\*[^!](.|[\r\n])*?\*\//g
const lineCommentStart = /\/\//g
const symbolRegex = /(\s*[;:{},]\s*)/g

// Counts occurences of substr inside str
const countOccurences = (str, substr) => str.split(substr).length - 1

// Joins substrings until predicate returns true
const reduceSubstr = (substrs, join, predicate) => {
  const length = substrs.length
  let res = substrs[0]

  if (length === 1) {
    return res
  }

  for (let i = 1; i < length; i++) {
    if (predicate(res)) {
      break
    }

    res += join + substrs[i]
  }

  return res
}

// Joins at comment starts when it's inside a string or parantheses
// effectively removing line comments
export const stripLineComment = (line: string) =>
  reduceSubstr(
    line.split(lineCommentStart),
    '//',
    str =>
      !str.endsWith(':') && // NOTE: This is another guard against urls, if they're not inside strings or parantheses.
      countOccurences(str, "'") % 2 === 0 &&
      countOccurences(str, '"') % 2 === 0 &&
      countOccurences(str, '(') === countOccurences(str, ')')
  )

export const compressSymbols = (code: string) =>
  code.split(symbolRegex).reduce((str, fragment, index) => {
    // Even-indices are non-symbol fragments
    if (index % 2 === 0) {
      return str + fragment
    }

    // Only manipulate symbols outside of strings
    if (
      countOccurences(str, "'") % 2 === 0 &&
      countOccurences(str, '"') % 2 === 0
    ) {
      return str + fragment.trim()
    }

    return str + fragment
  }, '')

// Detects lines that are exclusively line comments
const isLineComment = line => line.trim().startsWith('//')
const linebreakRegex = /[\r\n]\s*/g
const spacesAndLinebreakRegex = /\s+|\n+/g

function multilineReplacer(match: string) {
  // When we encounter a standard multi-line CSS comment and it contains a '@'
  // character, we keep the comment but optimize it into a single line. Some
  // Stylis plugins, such as the stylis-rtl via the cssjanus plugin, use this
  // special comment syntax to control behavior (such as: /* @noflip */).
  // We can do this with standard CSS comments because they will work with
  // compression, as opposed to non-standard single-line comments that will
  // break compressed CSS. If the comment doesn't contain '@', then we replace
  // it with a line break, which effectively removes it from the output.

  const keepComment = match.indexOf('@') > -1

  if (keepComment) {
    return match.replace(spacesAndLinebreakRegex, ' ').trim()
  }

  return '\n'
}

export const minify = (code: string) => {
  const newCode = code
    .replace(multilineCommentRegex, multilineReplacer) // If allowed, remove line breaks and extra space from multi-line comments so they appear on one line
    .split(linebreakRegex) // Split at newlines
    .filter(line => line.length > 0 && !isLineComment(line)) // Removes lines containing only line comments
    .map(stripLineComment) // Remove line comments inside text
    .join(' ') // Rejoin all lines

  return compressSymbols(newCode)
}
