'use strict'

var high = require('highlight.js/lib/highlight.js')
var fault = require('fault')

/* The lowlight interface, which has to be compatible
 * with highlight.js, as this object is passed to
 * highlight.js syntaxes. */

function High() {}

High.prototype = high

/* Expose. */
var low = new High() // Ha!

module.exports = low

low.highlight = highlight
low.highlightAuto = autoHighlight
low.registerLanguage = registerLanguage
low.getLanguage = getLanguage

var inherit = high.inherit
var own = {}.hasOwnProperty
var concat = [].concat

var defaultPrefix = 'hljs-'
var keyInsensitive = 'case_insensitive'
var keyCachedVariants = 'cached_variants'
var space = ' '
var pipe = '|'

var T_ELEMENT = 'element'
var T_TEXT = 'text'
var T_SPAN = 'span'

/* Maps of syntaxes. */
var languageNames = []
var languages = {}
var aliases = {}

/* Highlighting with language detection.  Accepts a string
 * with the code to highlight.  Returns an object with the
 * following properties:
 *
 * - language (detected language)
 * - relevance (int)
 * - value (a HAST tree with highlighting markup)
 * - secondBest (object with the same structure for
 *   second-best heuristically detected language, may
 *   be absent) */
function autoHighlight(value, options) {
  var settings = options || {}
  var subset = settings.subset || languageNames
  var prefix = settings.prefix
  var length = subset.length
  var index = -1
  var result
  var secondBest
  var current
  var name

  if (prefix === null || prefix === undefined) {
    prefix = defaultPrefix
  }

  if (typeof value !== 'string') {
    throw fault('Expected `string` for value, got `%s`', value)
  }

  secondBest = normalize({})
  result = normalize({})

  while (++index < length) {
    name = subset[index]

    if (!getLanguage(name)) {
      continue
    }

    current = normalize(coreHighlight(name, value, false, prefix))

    current.language = name

    if (current.relevance > secondBest.relevance) {
      secondBest = current
    }

    if (current.relevance > result.relevance) {
      secondBest = result
      result = current
    }
  }

  if (secondBest.language) {
    result.secondBest = secondBest
  }

  return result
}

/* Highlighting `value` in the language `language`. */
function highlight(language, value, options) {
  var settings = options || {}
  var prefix = settings.prefix

  if (prefix === null || prefix === undefined) {
    prefix = defaultPrefix
  }

  return normalize(coreHighlight(language, value, true, prefix))
}

/* Register a language. */
function registerLanguage(name, syntax) {
  var lang = syntax(low)
  var values = lang.aliases
  var length = values && values.length
  var index = -1

  languages[name] = lang

  languageNames.push(name)

  while (++index < length) {
    aliases[values[index]] = name
  }
}

/* Core highlighting function.  Accepts a language name, or
 * an alias, and a string with the code to highlight.
 * Returns an object with the following properties: */
function coreHighlight(name, value, ignore, prefix, continuation) {
  var continuations = {}
  var stack = []
  var modeBuffer = ''
  var relevance = 0
  var language
  var top
  var current
  var currentChildren
  var offset
  var count
  var match
  var children

  if (typeof name !== 'string') {
    throw fault('Expected `string` for name, got `%s`', name)
  }

  if (typeof value !== 'string') {
    throw fault('Expected `string` for value, got `%s`', value)
  }

  language = getLanguage(name)
  top = continuation || language
  children = []

  current = top
  currentChildren = children

  if (!language) {
    throw fault('Unknown language: `%s` is not registered', name)
  }

  compileLanguage(language)

  try {
    top.terminators.lastIndex = 0
    offset = 0
    match = top.terminators.exec(value)

    while (match) {
      count = processLexeme(value.substring(offset, match.index), match[0])
      offset = match.index + count
      top.terminators.lastIndex = offset
      match = top.terminators.exec(value)
    }

    processLexeme(value.substr(offset))
    current = top

    while (current.parent) {
      if (current.className) {
        pop()
      }

      current = current.parent
    }

    return {
      relevance: relevance,
      value: currentChildren,
      language: name,
      top: top
    }
  } catch (err) {
    /* istanbul ignore if - Catch-all  */
    if (err.message.indexOf('Illegal') === -1) {
      throw err
    }

    return {relevance: 0, value: addText(value, [])}
  }

  /* Process a lexeme.  Returns next position. */
  function processLexeme(buffer, lexeme) {
    var newMode
    var endMode
    var origin

    modeBuffer += buffer

    if (lexeme === undefined) {
      addSiblings(processBuffer(), currentChildren)

      return 0
    }

    newMode = subMode(lexeme, top)

    if (newMode) {
      addSiblings(processBuffer(), currentChildren)

      startNewMode(newMode, lexeme)

      return newMode.returnBegin ? 0 : lexeme.length
    }

    endMode = endOfMode(top, lexeme)

    if (endMode) {
      origin = top

      if (!(origin.returnEnd || origin.excludeEnd)) {
        modeBuffer += lexeme
      }

      addSiblings(processBuffer(), currentChildren)

      /* Close open modes. */
      do {
        if (top.className) {
          pop()
        }

        relevance += top.relevance
        top = top.parent
      } while (top !== endMode.parent)

      if (origin.excludeEnd) {
        addText(lexeme, currentChildren)
      }

      modeBuffer = ''

      if (endMode.starts) {
        startNewMode(endMode.starts, '')
      }

      return origin.returnEnd ? 0 : lexeme.length
    }

    if (isIllegal(lexeme, top)) {
      throw fault(
        'Illegal lexeme "%s" for mode "%s"',
        lexeme,
        top.className || '<unnamed>'
      )
    }

    /* Parser should not reach this point as all
     * types of lexemes should be caught earlier,
     * but if it does due to some bug make sure it
     * advances at least one character forward to
     * prevent infinite looping. */
    modeBuffer += lexeme

    return lexeme.length || /* istanbul ignore next */ 1
  }

  /* Start a new mode with a `lexeme` to process. */
  function startNewMode(mode, lexeme) {
    var node

    if (mode.className) {
      node = build(mode.className, [])
    }

    if (mode.returnBegin) {
      modeBuffer = ''
    } else if (mode.excludeBegin) {
      addText(lexeme, currentChildren)

      modeBuffer = ''
    } else {
      modeBuffer = lexeme
    }

    /* Enter a new mode. */
    if (node) {
      currentChildren.push(node)
      stack.push(currentChildren)
      currentChildren = node.children
    }

    top = Object.create(mode, {parent: {value: top}})
  }

  /* Process the buffer. */
  function processBuffer() {
    var result = top.subLanguage ? processSubLanguage() : processKeywords()
    modeBuffer = ''
    return result
  }

  /* Process a sublanguage (returns a list of nodes). */
  function processSubLanguage() {
    var explicit = typeof top.subLanguage === 'string'
    var subvalue

    /* istanbul ignore if - support non-loaded sublanguages */
    if (explicit && !languages[top.subLanguage]) {
      return addText(modeBuffer, [])
    }

    if (explicit) {
      subvalue = coreHighlight(
        top.subLanguage,
        modeBuffer,
        true,
        prefix,
        continuations[top.subLanguage]
      )
    } else {
      subvalue = autoHighlight(modeBuffer, {
        subset: top.subLanguage.length ? top.subLanguage : undefined,
        prefix: prefix
      })
    }

    /* Counting embedded language score towards the
     * host language may be disabled with zeroing the
     * containing mode relevance.  Usecase in point is
     * Markdown that allows XML everywhere and makes
     * every XML snippet to have a much larger Markdown
     * score. */
    if (top.relevance > 0) {
      relevance += subvalue.relevance
    }

    if (explicit) {
      continuations[top.subLanguage] = subvalue.top
    }

    return [build(subvalue.language, subvalue.value, true)]
  }

  /* Process keywords. Returns nodes. */
  function processKeywords() {
    var nodes = []
    var lastIndex
    var keyword
    var node
    var submatch

    if (!top.keywords) {
      return addText(modeBuffer, nodes)
    }

    lastIndex = 0

    top.lexemesRe.lastIndex = 0

    keyword = top.lexemesRe.exec(modeBuffer)

    while (keyword) {
      addText(modeBuffer.substring(lastIndex, keyword.index), nodes)

      submatch = keywordMatch(top, keyword)

      if (submatch) {
        relevance += submatch[1]

        node = build(submatch[0], [])

        nodes.push(node)

        addText(keyword[0], node.children)
      } else {
        addText(keyword[0], nodes)
      }

      lastIndex = top.lexemesRe.lastIndex
      keyword = top.lexemesRe.exec(modeBuffer)
    }

    addText(modeBuffer.substr(lastIndex), nodes)

    return nodes
  }

  /* Add siblings. */
  function addSiblings(siblings, nodes) {
    var length = siblings.length
    var index = -1
    var sibling

    while (++index < length) {
      sibling = siblings[index]

      if (sibling.type === T_TEXT) {
        addText(sibling.value, nodes)
      } else {
        nodes.push(sibling)
      }
    }
  }

  /* Add a text. */
  function addText(value, nodes) {
    var tail

    if (value) {
      tail = nodes[nodes.length - 1]

      if (tail && tail.type === T_TEXT) {
        tail.value += value
      } else {
        nodes.push(buildText(value))
      }
    }

    return nodes
  }

  /* Build a text. */
  function buildText(value) {
    return {type: T_TEXT, value: value}
  }

  /* Build a span. */
  function build(name, contents, noPrefix) {
    return {
      type: T_ELEMENT,
      tagName: T_SPAN,
      properties: {
        className: [(noPrefix ? '' : prefix) + name]
      },
      children: contents
    }
  }

  /* Check if the first word in `keywords` is a keyword. */
  function keywordMatch(mode, keywords) {
    var keyword = keywords[0]

    if (language[keyInsensitive]) {
      keyword = keyword.toLowerCase()
    }

    return own.call(mode.keywords, keyword) && mode.keywords[keyword]
  }

  /* Check if `lexeme` is illegal according to `mode`. */
  function isIllegal(lexeme, mode) {
    return !ignore && test(mode.illegalRe, lexeme)
  }

  /* Check if `lexeme` ends `mode`. */
  function endOfMode(mode, lexeme) {
    if (test(mode.endRe, lexeme)) {
      while (mode.endsParent && mode.parent) {
        mode = mode.parent
      }

      return mode
    }

    if (mode.endsWithParent) {
      return endOfMode(mode.parent, lexeme)
    }
  }

  /* Check a sub-mode. */
  function subMode(lexeme, mode) {
    var values = mode.contains
    var length = values.length
    var index = -1

    while (++index < length) {
      if (test(values[index].beginRe, lexeme)) {
        return values[index]
      }
    }
  }

  /* Exit the current context. */
  function pop() {
    /* istanbul ignore next - removed in hljs 9.3 */
    currentChildren = stack.pop() || children
  }
}

function expandMode(mode) {
  var length
  var index
  var variants
  var result

  if (mode.variants && !mode[keyCachedVariants]) {
    variants = mode.variants
    length = variants.length
    index = -1
    result = []

    while (++index < length) {
      result[index] = inherit(mode, {variants: null}, variants[index])
    }

    mode[keyCachedVariants] = result
  }

  return (
    mode[keyCachedVariants] || (mode.endsWithParent ? [inherit(mode)] : [mode])
  )
}

/* Compile a language. */
function compileLanguage(language) {
  compileMode(language)

  /* Compile a language mode, optionally with a parent. */
  function compileMode(mode, parent) {
    var compiledKeywords = {}
    var terminators

    if (mode.compiled) {
      return
    }

    mode.compiled = true

    mode.keywords = mode.keywords || mode.beginKeywords

    if (mode.keywords) {
      if (typeof mode.keywords === 'string') {
        flatten('keyword', mode.keywords)
      } else {
        Object.keys(mode.keywords).forEach(function(className) {
          flatten(className, mode.keywords[className])
        })
      }

      mode.keywords = compiledKeywords
    }

    mode.lexemesRe = langRe(mode.lexemes || /\w+/, true)

    if (parent) {
      if (mode.beginKeywords) {
        mode.begin =
          '\\b(' + mode.beginKeywords.split(space).join(pipe) + ')\\b'
      }

      if (!mode.begin) {
        mode.begin = /\B|\b/
      }

      mode.beginRe = langRe(mode.begin)

      if (!mode.end && !mode.endsWithParent) {
        mode.end = /\B|\b/
      }

      if (mode.end) {
        mode.endRe = langRe(mode.end)
      }

      mode.terminatorEnd = source(mode.end) || ''

      if (mode.endsWithParent && parent.terminatorEnd) {
        mode.terminatorEnd += (mode.end ? pipe : '') + parent.terminatorEnd
      }
    }

    if (mode.illegal) {
      mode.illegalRe = langRe(mode.illegal)
    }

    if (mode.relevance === undefined) {
      mode.relevance = 1
    }

    if (!mode.contains) {
      mode.contains = []
    }

    mode.contains = concat.apply(
      [],
      mode.contains.map(function(c) {
        return expandMode(c === 'self' ? mode : c)
      })
    )

    mode.contains.forEach(function(c) {
      compileMode(c, mode)
    })

    if (mode.starts) {
      compileMode(mode.starts, parent)
    }

    terminators = mode.contains
      .map(map)
      .concat([mode.terminatorEnd, mode.illegal])
      .map(source)
      .filter(Boolean)

    mode.terminators = terminators.length
      ? langRe(terminators.join(pipe), true)
      : {exec: execNoop}

    function map(c) {
      return c.beginKeywords ? '\\.?(' + c.begin + ')\\.?' : c.begin
    }

    /* Flatten a classname. */
    function flatten(className, value) {
      var pairs
      var pair
      var index
      var length

      if (language[keyInsensitive]) {
        value = value.toLowerCase()
      }

      pairs = value.split(space)
      length = pairs.length
      index = -1

      while (++index < length) {
        pair = pairs[index].split(pipe)

        compiledKeywords[pair[0]] = [className, pair[1] ? Number(pair[1]) : 1]
      }
    }
  }

  /* Create a regex for `value`. */
  function langRe(value, global) {
    return new RegExp(
      source(value),
      'm' + (language[keyInsensitive] ? 'i' : '') + (global ? 'g' : '')
    )
  }

  /* Get the source of an expression or string. */
  function source(re) {
    return (re && re.source) || re
  }
}

/* Normalize a syntax result. */
function normalize(result) {
  return {
    relevance: result.relevance || 0,
    language: result.language || null,
    value: result.value || []
  }
}

/* Check if `expression` matches `lexeme`. */
function test(expression, lexeme) {
  var match = expression && expression.exec(lexeme)
  return match && match.index === 0
}

/* No-op exec. */
function execNoop() {
  return null
}

/* Get a language by `name`. */
function getLanguage(name) {
  name = name.toLowerCase()

  return languages[name] || languages[aliases[name]]
}
