const bitapRegexSearch = require('./bitap_regex_search')
const bitapSearch = require('./bitap_search')
const patternAlphabet = require('./bitap_pattern_alphabet')

class Bitap {
  constructor (pattern, {
    // Approximately where in the text is the pattern expected to be found?
    location = 0,
    // Determines how close the match must be to the fuzzy location (specified above).
    // An exact letter match which is 'distance' characters away from the fuzzy location
    // would score as a complete mismatch. A distance of '0' requires the match be at
    // the exact location specified, a threshold of '1000' would require a perfect match
    // to be within 800 characters of the fuzzy location to be found using a 0.8 threshold.
    distance = 100,
    // At what point does the match algorithm give up. A threshold of '0.0' requires a perfect match
    // (of both letters and location), a threshold of '1.0' would match anything.
    threshold = 0.6,
    // Machine word size
    maxPatternLength = 32,
    // Indicates whether comparisons should be case sensitive.
    isCaseSensitive = false,
    // Regex used to separate words when searching. Only applicable when `tokenize` is `true`.
    tokenSeparator = / +/g,
    // When true, the algorithm continues searching to the end of the input even if a perfect
    // match is found before the end of the same input.
    findAllMatches = false,
    // Minimum number of characters that must be matched before a result is considered a match
    minMatchCharLength = 1
  }) {
    this.options = {
      location,
      distance,
      threshold,
      maxPatternLength,
      isCaseSensitive,
      tokenSeparator,
      findAllMatches,
      minMatchCharLength
    }

    this.pattern = this.options.isCaseSensitive ? pattern : pattern.toLowerCase()

    if (this.pattern.length <= maxPatternLength) {
      this.patternAlphabet = patternAlphabet(this.pattern)
    }
  }

  search (text) {
    if (!this.options.isCaseSensitive) {
      text = text.toLowerCase()
    }

    // Exact match
    if (this.pattern === text) {
      return {
        isMatch: true,
        score: 0,
        matchedIndices: [[0, text.length - 1]]
      }
    }

    // When pattern length is greater than the machine word length, just do a a regex comparison
    const { maxPatternLength, tokenSeparator } = this.options
    if (this.pattern.length > maxPatternLength) {
      return bitapRegexSearch(text, this.pattern, tokenSeparator)
    }

    // Otherwise, use Bitap algorithm
    const { location, distance, threshold, findAllMatches, minMatchCharLength } = this.options
    return bitapSearch(text, this.pattern, this.patternAlphabet, {
      location,
      distance,
      threshold,
      findAllMatches,
      minMatchCharLength
    })
  }
}

// let x = new Bitap("od mn war", {})
// let result = x.search("Old Man's War")
// console.log(result)

module.exports = Bitap
