const bitapScore = require('./bitap_score')
const matchedIndices = require('./bitap_matched_indices')

module.exports = (text, pattern, patternAlphabet, { location = 0, distance = 100, threshold = 0.6, findAllMatches = false, minMatchCharLength = 1 }) => {
  const expectedLocation = location
  // Set starting location at beginning text and initialize the alphabet.
  const textLen = text.length
  // Highest score beyond which we give up.
  let currentThreshold = threshold
  // Is there a nearby exact match? (speedup)
  let bestLocation = text.indexOf(pattern, expectedLocation)

  const patternLen = pattern.length

  // a mask of the matches
  const matchMask = []
  for (let i = 0; i < textLen; i += 1) {
    matchMask[i] = 0
  }

  if (bestLocation !== -1) {
    let score = bitapScore(pattern, {
      errors: 0,
      currentLocation: bestLocation,
      expectedLocation,
      distance
    })
    currentThreshold = Math.min(score, currentThreshold)

    // What about in the other direction? (speed up)
    bestLocation = text.lastIndexOf(pattern, expectedLocation + patternLen)

    if (bestLocation !== -1) {
      let score = bitapScore(pattern, {
        errors: 0,
        currentLocation: bestLocation,
        expectedLocation,
        distance
      })
      currentThreshold = Math.min(score, currentThreshold)
    }
  }

  // Reset the best location
  bestLocation = -1

  let lastBitArr = []
  let finalScore = 1
  let binMax = patternLen + textLen

  const mask = 1 << (patternLen - 1)

  for (let i = 0; i < patternLen; i += 1) {
    // Scan for the best match; each iteration allows for one more error.
    // Run a binary search to determine how far from the match location we can stray
    // at this error level.
    let binMin = 0
    let binMid = binMax

    while (binMin < binMid) {
      const score = bitapScore(pattern, {
        errors: i,
        currentLocation: expectedLocation + binMid,
        expectedLocation,
        distance
      })

      if (score <= currentThreshold) {
        binMin = binMid
      } else {
        binMax = binMid
      }

      binMid = Math.floor((binMax - binMin) / 2 + binMin)
    }

    // Use the result from this iteration as the maximum for the next.
    binMax = binMid

    let start = Math.max(1, expectedLocation - binMid + 1)
    let finish = findAllMatches ? textLen : Math.min(expectedLocation + binMid, textLen) + patternLen

    // Initialize the bit array
    let bitArr = Array(finish + 2)

    bitArr[finish + 1] = (1 << i) - 1

    for (let j = finish; j >= start; j -= 1) {
      let currentLocation = j - 1
      let charMatch = patternAlphabet[text.charAt(currentLocation)]

      if (charMatch) {
        matchMask[currentLocation] = 1
      }

      // First pass: exact match
      bitArr[j] = ((bitArr[j + 1] << 1) | 1) & charMatch

      // Subsequent passes: fuzzy match
      if (i !== 0) {
        bitArr[j] |= (((lastBitArr[j + 1] | lastBitArr[j]) << 1) | 1) | lastBitArr[j + 1]
      }

      if (bitArr[j] & mask) {
        finalScore = bitapScore(pattern, {
          errors: i,
          currentLocation,
          expectedLocation,
          distance
        })

        // This match will almost certainly be better than any existing match.
        // But check anyway.
        if (finalScore <= currentThreshold) {
          // Indeed it is
          currentThreshold = finalScore
          bestLocation = currentLocation

          // Already passed `loc`, downhill from here on in.
          if (bestLocation <= expectedLocation) {
            break
          }

          // When passing `bestLocation`, don't exceed our current distance from `expectedLocation`.
          start = Math.max(1, 2 * expectedLocation - bestLocation)
        }
      }
    }

    // No hope for a (better) match at greater error levels.
    const score = bitapScore(pattern, {
      errors: i + 1,
      currentLocation: expectedLocation,
      expectedLocation,
      distance
    })

    // console.log('score', score, finalScore)

    if (score > currentThreshold) {
      break
    }

    lastBitArr = bitArr
  }

  // console.log('FINAL SCORE', finalScore)

  // Count exact matches (those with a score of 0) to be "almost" exact
  return {
    isMatch: bestLocation >= 0,
    score: finalScore === 0 ? 0.001 : finalScore,
    matchedIndices: matchedIndices(matchMask, minMatchCharLength)
  }
}
