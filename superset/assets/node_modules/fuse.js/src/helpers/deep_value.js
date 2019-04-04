const isArray = require('./is_array')

const deepValue = (obj, path, list) => {
  if (!path) {
    // If there's no path left, we've gotten to the object we care about.
    list.push(obj)
  } else {
    const dotIndex = path.indexOf('.')
    let firstSegment = path
    let remaining = null

    if (dotIndex !== -1) {
      firstSegment = path.slice(0, dotIndex)
      remaining = path.slice(dotIndex + 1)
    }

    const value = obj[firstSegment]

    if (value !== null && value !== undefined) {
      if (!remaining && (typeof value === 'string' || typeof value === 'number')) {
        list.push(value.toString())
      } else if (isArray(value)) {
        // Search each item in the array.
        for (let i = 0, len = value.length; i < len; i += 1) {
          deepValue(value[i], remaining, list)
        }
      } else if (remaining) {
        // An object. Recurse further.
        deepValue(value, remaining, list)
      }
    }
  }

  return list
}

module.exports = (obj, path) => {
  return deepValue(obj, path, [])
}
