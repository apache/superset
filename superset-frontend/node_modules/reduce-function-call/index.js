/*
 * Module dependencies
 */
var balanced = require("balanced-match")

/**
 * Expose `reduceFunctionCall`
 *
 * @type {Function}
 */
module.exports = reduceFunctionCall

/**
 * Walkthrough all expressions, evaluate them and insert them into the declaration
 *
 * @param {Array} expressions
 * @param {Object} declaration
 */

function reduceFunctionCall(string, functionRE, callback) {
  var call = string
  return getFunctionCalls(string, functionRE).reduce(function(string, obj) {
    return string.replace(obj.functionIdentifier + "(" + obj.matches.body + ")", evalFunctionCall(obj.matches.body, obj.functionIdentifier, callback, call, functionRE))
  }, string)
}

/**
 * Parses expressions in a value
 *
 * @param {String} value
 * @returns {Array}
 * @api private
 */

function getFunctionCalls(call, functionRE) {
  var expressions = []

  var fnRE = typeof functionRE === "string" ? new RegExp("\\b(" + functionRE + ")\\(") : functionRE
  do {
    var searchMatch = fnRE.exec(call)
    if (!searchMatch) {
      return expressions
    }
    if (searchMatch[1] === undefined) {
      throw new Error("Missing the first couple of parenthesis to get the function identifier in " + functionRE)
    }
    var fn = searchMatch[1]
    var startIndex = searchMatch.index
    var matches = balanced("(", ")", call.substring(startIndex))

    if (!matches || matches.start !== searchMatch[0].length - 1) {
      throw new SyntaxError(fn + "(): missing closing ')' in the value '" + call + "'")
    }

    expressions.push({matches: matches, functionIdentifier: fn})
    call = matches.post
  }
  while (fnRE.test(call))

  return expressions
}

/**
 * Evaluates an expression
 *
 * @param {String} expression
 * @returns {String}
 * @api private
 */

function evalFunctionCall (string, functionIdentifier, callback, call, functionRE) {
  // allow recursivity
  return callback(reduceFunctionCall(string, functionRE, callback), functionIdentifier, call)
}
