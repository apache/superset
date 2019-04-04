var url = 'bjectSymhasOwnProp-0123456789ABCDEFGHIJKLMNQRTUVWXYZ_dfgiklquvxz'

/**
 * Generate URL-friendly unique ID. This method use non-secure predictable
 * random generator.
 *
 * By default, ID will have 21 symbols to have a collision probability similar
 * to UUID v4.
 *
 * @param {number} [size=21] The number of symbols in ID.
 *
 * @return {string} Random string.
 *
 * @example
 * const nanoid = require('nanoid/non-secure')
 * model.id = nanoid() //=> "Uakgb_J5m9g-0JDMbcJqL"
 *
 * @name nonSecure
 * @function
 */
module.exports = function (size) {
  size = size || 21
  var id = ''
  while (0 < size--) {
    id += url[Math.random() * 64 | 0]
  }
  return id
}
