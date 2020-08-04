var random = require('./random')
var format = require('./format')

/**
 * Low-level function to change alphabet and ID size.
 *
 * Alphabet must contain 256 symbols or less. Otherwise, the generator
 * will not be secure.
 *
 * @param {string} alphabet Symbols to be used in ID.
 * @param {number} size The number of symbols in ID.
 *
 * @return {string} Unique ID.
 *
 * @example
 * const generate = require('nanoid/generate')
 * model.id = generate('0123456789абвгдеё', 5) //=> "8ё56а"
 *
 * @name generate
 * @function
 */
module.exports = function (alphabet, size) {
  return format(random, alphabet, size)
}
