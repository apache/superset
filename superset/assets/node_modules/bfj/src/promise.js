'use strict'

module.exports = (options = {}) => options.Promise || require('bluebird')
