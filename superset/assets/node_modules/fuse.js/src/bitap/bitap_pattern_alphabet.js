module.exports = (pattern) => {
  let mask = {}
  let len = pattern.length

  for (let i = 0; i < len; i += 1) {
    mask[pattern.charAt(i)] = 0
  }

  for (let i = 0; i < len; i += 1) {
    mask[pattern.charAt(i)] |= 1 << (len - i - 1)
  }

  return mask
}
