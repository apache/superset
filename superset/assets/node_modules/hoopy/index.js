'use strict'

class Hoopy extends Array {
  constructor (size) {
    let index, isIndexOverflowed

    if (! isPositiveInteger(size)) {
      throw new TypeError('Argument `size` must be a positive integer.')
    }

    super(size)

    this.grow = by => {
      if (! isPositiveInteger(by)) {
        throw new TypeError('Argument `by` must be a positive integer.')
      }

      let i
      const newSize = size + by

      for (i = size; i < newSize; ++i) {
        this[i] = undefined
      }

      if (isIndexOverflowed) {
        for (i = 0; i <= index; ++i) {
          let j = size + i
          if (j >= newSize) {
            j %= newSize
          }
          this[j] = this[i]
          this[i] = undefined
        }
      }

      size = newSize
    }

    return new Proxy(this, {
      get (target, key) {
        if (isInteger(key)) {
          return target[getIndex(key, size)]
        }

        return target[key]
      },

      set (target, key, value) {
        if (isInteger(key)) {
          index = getIndex(key, size)
          target[index] = value

          if (Math.abs(key) >= size) {
            isIndexOverflowed = true
          } else {
            isIndexOverflowed = false
          }
        } else {
          target[key] = value
        }
        return true
      }
    })
  }
}

function isPositiveInteger (thing) {
  return isInteger(thing) && thing > 0
}

function isInteger (thing) {
  try {
    return +thing % 1 === 0
  } catch (error) {
    // Coercing symbols to numbers throws an error
  }

  return false
}

function getIndex (key, size) {
  if (key === 0) {
    return 0
  }

  if (key < 0) {
    return (size - Math.abs(key)) % size
  }

  return key % size
}

function nop () {
  throw new Error('Not implemented')
}

Hoopy.prototype.push = nop
Hoopy.prototype.pop = nop
Hoopy.prototype.shift = nop
Hoopy.prototype.unshift = nop

module.exports = Hoopy

