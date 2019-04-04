/**
 * Module dependencies
 */
var balanced = require("balanced-match")
var reduceFunctionCall = require("reduce-function-call")
var mexp = require("math-expression-evaluator")

/**
 * Constantes
 */
var MAX_STACK = 100 // should be enough for a single calc()...
var NESTED_CALC_RE = /(\+|\-|\*|\\|[^a-z]|)(\s*)(\()/g

/**
 * Global variables
 */
var stack

/**
 * Expose reduceCSSCalc plugin
 *
 * @type {Function}
 */
module.exports = reduceCSSCalc

/**
 * Reduce CSS calc() in a string, whenever it's possible
 *
 * @param {String} value css input
 */
function reduceCSSCalc(value, decimalPrecision) {
  stack = 0
  decimalPrecision = Math.pow(10, decimalPrecision === undefined ? 5 : decimalPrecision)

  // Allow calc() on multiple lines
  value = value.replace(/\n+/g, " ")

  /**
   * Evaluates an expression
   *
   * @param {String} expression
   * @returns {String}
   */
  function evaluateExpression (expression, functionIdentifier, call) {
    if (stack++ > MAX_STACK) {
      stack = 0
      throw new Error("Call stack overflow for " + call)
    }

    if (expression === "") {
      throw new Error(functionIdentifier + "(): '" + call + "' must contain a non-whitespace string")
    }

    expression = evaluateNestedExpression(expression, call)

    var units = getUnitsInExpression(expression)

    // If the expression contains multiple units or CSS variables,
    // then let the expression be (i.e. browser calc())
    if (units.length > 1 || expression.indexOf("var(") > -1) {
      return functionIdentifier + "(" + expression + ")"
    }

    var unit = units[0] || ""

    if (unit === "%") {
      // Convert percentages to numbers, to handle expressions like: 50% * 50% (will become: 25%):
      // console.log(expression)
      expression = expression.replace(/\b[0-9\.]+%/g, function(percent) {
        return parseFloat(percent.slice(0, -1)) * 0.01
      })
    }

    // Remove units in expression:
    var toEvaluate = expression.replace(new RegExp(unit, "gi"), "")
    var result

    try {
      result = mexp.eval(toEvaluate)
    }
    catch (e) {
      return functionIdentifier + "(" + expression + ")"
    }

    // Transform back to a percentage result:
    if (unit === "%") {
      result *= 100
    }

    // adjust rounding shit
    // (0.1 * 0.2 === 0.020000000000000004)
    if (functionIdentifier.length || unit === "%") {
      result = Math.round(result * decimalPrecision) / decimalPrecision
    }

    // Add unit
    result += unit

    return result
  }

  /**
   * Evaluates nested expressions
   *
   * @param {String} expression
   * @returns {String}
   */
  function evaluateNestedExpression(expression, call) {
    // Remove the calc part from nested expressions to ensure
    // better browser compatibility
    expression = expression.replace(/((?:\-[a-z]+\-)?calc)/g, "")
    var evaluatedPart = ""
    var nonEvaluatedPart = expression
    var matches
    while ((matches = NESTED_CALC_RE.exec(nonEvaluatedPart))) {
      if (matches[0].index > 0) {
        evaluatedPart += nonEvaluatedPart.substring(0, matches[0].index)
      }

      var balancedExpr = balanced("(", ")", nonEvaluatedPart.substring([0].index))
      if (balancedExpr.body === "") {
        throw new Error("'" + expression + "' must contain a non-whitespace string")
      }

      var evaluated = evaluateExpression(balancedExpr.body, "", call)

      evaluatedPart += balancedExpr.pre + evaluated
      nonEvaluatedPart = balancedExpr.post
    }

    return evaluatedPart + nonEvaluatedPart
  }

  return reduceFunctionCall(value, /((?:\-[a-z]+\-)?calc)\(/, evaluateExpression)
}

/**
 * Checks what units are used in an expression
 *
 * @param {String} expression
 * @returns {Array}
 */

function getUnitsInExpression(expression) {
  var uniqueUnits = []
  var uniqueLowerCaseUnits = []
  var unitRegEx = /[\.0-9]([%a-z]+)/gi
  var matches = unitRegEx.exec(expression)

  while (matches) {
    if (!matches || !matches[1]) {
      continue
    }

    if (uniqueLowerCaseUnits.indexOf(matches[1].toLowerCase()) === -1) {
      uniqueUnits.push(matches[1])
      uniqueLowerCaseUnits.push(matches[1].toLowerCase())
    }

    matches = unitRegEx.exec(expression)
  }

  return uniqueUnits
}
