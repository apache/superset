const SPECIAL_CHARS_REGEX = /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g

module.exports = (text, pattern, tokenSeparator = / +/g) => {
  let regex = new RegExp(pattern.replace(SPECIAL_CHARS_REGEX, '\\$&').replace(tokenSeparator, '|'))
  let matches = text.match(regex)
  let isMatch = !!matches
  let matchedIndices = []

  if (isMatch) {
    for (let i = 0, matchesLen = matches.length; i < matchesLen; i += 1) {
      let match = matches[i]
      matchedIndices.push([text.indexOf(match), match.length - 1])
    }
  }

  return {
    // TODO: revisit this score
    score: isMatch ? 0.5 : 1,
    isMatch,
    matchedIndices
  }
}
