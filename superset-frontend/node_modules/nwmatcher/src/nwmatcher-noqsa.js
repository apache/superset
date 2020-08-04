/*
 * Copyright (C) 2007-2018 Diego Perini
 * All rights reserved.
 *
 * nwmatcher-noqsa.js - A fast CSS selector engine and matcher
 *
 * Author: Diego Perini <diego.perini at gmail com>
 * Version: 1.4.4
 * Created: 20070722
 * Release: 20180305
 *
 * License:
 *  http://javascript.nwbox.com/NWMatcher/MIT-LICENSE
 * Download:
 *  http://javascript.nwbox.com/NWMatcher/nwmatcher.js
 */

(function(global, factory) {

  if (typeof module == 'object' && typeof exports == 'object') {
    module.exports = factory;
  } else if (typeof define === 'function' && define["amd"]) {
    define(factory);
  } else {
    global.NW || (global.NW = { });
    global.NW.Dom = factory(global);
  }

})(this, function(global) {

  var version = 'nwmatcher-1.4.4',

  doc = global.document,
  root = doc.documentElement,

  isSingleMatch,
  isSingleSelect,

  lastSlice,
  lastContext,
  lastPosition,

  lastMatcher,
  lastSelector,

  lastPartsMatch,
  lastPartsSelect,

  prefixes = '(?:[#.:]|::)?',
  operators = '([~*^$|!]?={1})',
  whitespace = '[\\x20\\t\\n\\r\\f]',
  combinators = '\\x20|[>+~](?=[^>+~])',
  pseudoparms = '(?:[-+]?\\d*n)?[-+]?\\d*',
  skip_groups = '\\[.*\\]|\\(.*\\)|\\{.*\\}',

  any_esc_chr = '\\\\.',
  alphalodash = '[_a-zA-Z]',
  non_asc_chr = '[^\\x00-\\x9f]',
  escaped_chr = '\\\\[^\\n\\r\\f0-9a-fA-F]',
  unicode_chr = '\\\\[0-9a-fA-F]{1,6}(?:\\r\\n|' + whitespace + ')?',

  quotedvalue = '"[^"\\\\]*(?:\\\\.[^"\\\\]*)*"' + "|'[^'\\\\]*(?:\\\\.[^'\\\\]*)*'",

  reSplitGroup = /([^,\\()[\]]+|\[[^[\]]*\]|\[.*\]|\([^()]+\)|\(.*\)|\{[^{}]+\}|\{.*\}|\\.)+/g,

  reTrimSpaces = RegExp('[\\n\\r\\f]|^' + whitespace + '+|' + whitespace + '+$', 'g'),

  reEscapedChars = /\\([0-9a-fA-F]{1,6}[\x20\t\n\r\f]?|.)|([\x22\x27])/g,

  standardValidator, extendedValidator, reValidator,

  attrcheck, attributes, attrmatcher, pseudoclass,

  reOptimizeSelector, reSimpleNot, reSplitToken,

  Optimize, identifier, extensions = '.+',

  Patterns = {
    spseudos: /^\:(root|empty|(?:first|last|only)(?:-child|-of-type)|nth(?:-last)?(?:-child|-of-type)\(\s?(even|odd|(?:[-+]{0,1}\d*n\s?)?[-+]{0,1}\s?\d*)\s?\))?(.*)/i,
    dpseudos: /^\:(link|visited|target|active|focus|hover|checked|disabled|enabled|selected|lang\(([-\w]{2,})\)|(?:matches|not)\(\s?(:nth(?:-last)?(?:-child|-of-type)\(\s?(?:even|odd|(?:[-+]{0,1}\d*n\s?)?[-+]{0,1}\s?\d*)\s?\)|[^()]*)\s?\))?(.*)/i,
    epseudos: /^((?:[:]{1,2}(?:after|before|first-letter|first-line))|(?:[:]{2,2}(?:selection|backdrop|placeholder)))?(.*)/i,
    children: RegExp('^' + whitespace + '?\\>' + whitespace + '?(.*)'),
    adjacent: RegExp('^' + whitespace + '?\\+' + whitespace + '?(.*)'),
    relative: RegExp('^' + whitespace + '?\\~' + whitespace + '?(.*)'),
    ancestor: RegExp('^' + whitespace + '+(.*)'),
    universal: RegExp('^\\*(.*)')
  },

  Tokens = {
    prefixes: prefixes,
    identifier: identifier,
    attributes: attributes
  },

  QUIRKS_MODE,
  XML_DOCUMENT,

  GEBTN = 'getElementsByTagName' in doc,
  GEBCN = 'getElementsByClassName' in doc,

  IE_LT_9 = typeof doc.addEventListener != 'function',

  LINK_NODES = { a: 1, A: 1, area: 1, AREA: 1, link: 1, LINK: 1 },

  ATTR_BOOLEAN = {
    checked: 1, disabled: 1, ismap: 1,
    multiple: 1, readonly: 1, selected: 1
  },

  ATTR_DEFAULT = {
    value: 'defaultValue',
    checked: 'defaultChecked',
    selected: 'defaultSelected'
  },

  ATTR_URIDATA = {
    action: 2, cite: 2, codebase: 2, data: 2, href: 2,
    longdesc: 2, lowsrc: 2, src: 2, usemap: 2
  },

  HTML_TABLE = {
    'accept': 1, 'accept-charset': 1, 'align': 1, 'alink': 1, 'axis': 1,
    'bgcolor': 1, 'charset': 1, 'checked': 1, 'clear': 1, 'codetype': 1, 'color': 1,
    'compact': 1, 'declare': 1, 'defer': 1, 'dir': 1, 'direction': 1, 'disabled': 1,
    'enctype': 1, 'face': 1, 'frame': 1, 'hreflang': 1, 'http-equiv': 1, 'lang': 1,
    'language': 1, 'link': 1, 'media': 1, 'method': 1, 'multiple': 1, 'nohref': 1,
    'noresize': 1, 'noshade': 1, 'nowrap': 1, 'readonly': 1, 'rel': 1, 'rev': 1,
    'rules': 1, 'scope': 1, 'scrolling': 1, 'selected': 1, 'shape': 1, 'target': 1,
    'text': 1, 'type': 1, 'valign': 1, 'valuetype': 1, 'vlink': 1
  },

  NATIVE_TRAVERSAL_API =
    'nextElementSibling' in root &&
    'previousElementSibling' in root,

  Selectors = { },

  Operators = {
     '=': "n=='%m'",
    '^=': "n.indexOf('%m')==0",
    '*=': "n.indexOf('%m')>-1",
    '|=': "(n+'-').indexOf('%m-')==0",
    '~=': "(' '+n+' ').indexOf(' %m ')>-1",
    '$=': "n.substr(n.length-'%m'.length)=='%m'"
  },

  concatCall =
    function(data, elements, callback) {
      var i = -1, element;
      while ((element = elements[++i])) {
        if (false === callback(data[data.length] = element)) { break; }
      }
      return data;
    },

  switchContext =
    function(from, force) {
      var oldDoc = doc;
      lastContext = from;
      doc = from.ownerDocument || from;
      if (force || oldDoc !== doc) {
        root = doc.documentElement;
        XML_DOCUMENT = doc.createElement('DiV').nodeName == 'DiV';
        QUIRKS_MODE = !XML_DOCUMENT &&
          typeof doc.compatMode == 'string' ?
          doc.compatMode.indexOf('CSS') < 0 :
          (function() {
            var style = doc.createElement('div').style;
            return style && (style.width = 1) && style.width == '1px';
          })();

        Config.CACHING && Dom.setCache(true, doc);
      }
    },

  codePointToUTF16 =
    function(codePoint) {
      if (codePoint < 1 || codePoint > 0x10ffff ||
        (codePoint > 0xd7ff && codePoint < 0xe000)) {
        return '\\ufffd';
      }
      if (codePoint < 0x10000) {
        var lowHex = '000' + codePoint.toString(16);
        return '\\u' + lowHex.substr(lowHex.length - 4);
      }
      return '\\u' + (((codePoint - 0x10000) >> 0x0a) + 0xd800).toString(16) +
             '\\u' + (((codePoint - 0x10000) % 0x400) + 0xdc00).toString(16);
    },

  stringFromCodePoint =
    function(codePoint) {
      if (codePoint < 1 || codePoint > 0x10ffff ||
        (codePoint > 0xd7ff && codePoint < 0xe000)) {
        return '\ufffd';
      }
      if (codePoint < 0x10000) {
        return String.fromCharCode(codePoint);
      }
      return String.fromCodePoint ?
        String.fromCodePoint(codePoint) :
        String.fromCharCode(
          ((codePoint - 0x10000) >> 0x0a) + 0xd800,
          ((codePoint - 0x10000) % 0x400) + 0xdc00);
    },

  convertEscapes =
    function(str) {
      return str.replace(reEscapedChars,
          function(substring, p1, p2) {
            return p2 ? '\\' + p2 :
              (/^[0-9a-fA-F]/).test(p1) ? codePointToUTF16(parseInt(p1, 16)) :
              (/^[\\\x22\x27]/).test(p1) ? substring :
              p1;
          }
        );
    },

  unescapeIdentifier =
    function(str) {
      return str.replace(reEscapedChars,
          function(substring, p1, p2) {
            return p2 ? p2 :
              (/^[0-9a-fA-F]/).test(p1) ? stringFromCodePoint(parseInt(p1, 16)) :
              (/^[\\\x22\x27]/).test(p1) ? substring :
              p1;
          }
        );
    },

  byIdRaw =
    function(id, elements) {
      var i = -1, element;
      while ((element = elements[++i])) {
        if (element.getAttribute('id') == id) {
          break;
        }
      }
      return element || null;
    },

  _byId = !IE_LT_9 ?
    function(id, from) {
      id = (/\\/).test(id) ? unescapeIdentifier(id) : id;
      return from.getElementById && from.getElementById(id) ||
        byIdRaw(id, from.getElementsByTagName('*'));
    } :
    function(id, from) {
      var element = null;
      id = (/\\/).test(id) ? unescapeIdentifier(id) : id;
      if (XML_DOCUMENT || from.nodeType != 9) {
        return byIdRaw(id, from.getElementsByTagName('*'));
      }
      if ((element = from.getElementById(id)) &&
        element.name == id && from.getElementsByName) {
        return byIdRaw(id, from.getElementsByName(id));
      }
      return element;
    },

  byId =
    function(id, from) {
      from || (from = doc);
      if (lastContext !== from) { switchContext(from); }
      return _byId(id, from);
    },

  byTagRaw =
    function(tag, from) {
      var any = tag == '*', element = from, elements = [ ], next = element.firstChild;
      any || (tag = tag.toUpperCase());
      while ((element = next)) {
        if (element.tagName > '@' && (any || element.tagName.toUpperCase() == tag)) {
          elements[elements.length] = element;
        }
        if ((next = element.firstChild || element.nextSibling)) continue;
        while (!next && (element = element.parentNode) && element !== from) {
          next = element.nextSibling;
        }
      }
      return elements;
    },

  contains = 'compareDocumentPosition' in root ?
    function(container, element) {
      return (container.compareDocumentPosition(element) & 16) == 16;
    } : 'contains' in root ?
    function(container, element) {
      return container !== element && container.contains(element);
    } :
    function(container, element) {
      while ((element = element.parentNode)) {
        if (element === container) return true;
      }
      return false;
    },

  getAttribute = !IE_LT_9 ?
    function(node, attribute) {
      return node.getAttribute(attribute);
    } :
    function(node, attribute) {
      attribute = attribute.toLowerCase();
      if (typeof node[attribute] == 'object') {
        return node.attributes[attribute] &&
          node.attributes[attribute].value;
      }
      return (
        attribute == 'type' ? node.getAttribute(attribute) :
        ATTR_URIDATA[attribute] ? node.getAttribute(attribute, 2) :
        ATTR_BOOLEAN[attribute] ? node.getAttribute(attribute) ? attribute : 'false' :
          (node = node.getAttributeNode(attribute)) && node.value);
    },

  hasAttribute = !IE_LT_9 && root.hasAttribute ?
    function(node, attribute) {
      return node.hasAttribute(attribute);
    } :
    function(node, attribute) {
      var obj = node.getAttributeNode(attribute = attribute.toLowerCase());
      return ATTR_DEFAULT[attribute] && attribute != 'value' ?
        node[ATTR_DEFAULT[attribute]] : obj && obj.specified;
    },

  isEmpty =
    function(node) {
      node = node.firstChild;
      while (node) {
        if (node.nodeType == 3 || node.nodeName > '@') return false;
        node = node.nextSibling;
      }
      return true;
    },

  isLink =
    function(element) {
      return hasAttribute(element, 'href') && LINK_NODES[element.nodeName];
    },

  nthElement =
    function(element, last) {
      var count = 1, succ = last ? 'nextSibling' : 'previousSibling';
      while ((element = element[succ])) {
        if (element.nodeName > '@') ++count;
      }
      return count;
    },

  nthOfType =
    function(element, last) {
      var count = 1, succ = last ? 'nextSibling' : 'previousSibling', type = element.nodeName;
      while ((element = element[succ])) {
        if (element.nodeName == type) ++count;
      }
      return count;
    },

  configure =
    function(option) {
      if (typeof option == 'string') { return !!Config[option]; }
      if (typeof option != 'object') { return Config; }
      for (var i in option) {
        Config[i] = !!option[i];
        if (i == 'SIMPLENOT') {
          matchContexts = { };
          matchResolvers = { };
          selectContexts = { };
          selectResolvers = { };
        }
      }
      setIdentifierSyntax();
      reValidator = RegExp(Config.SIMPLENOT ?
        standardValidator : extendedValidator);
      return true;
    },

  emit =
    function(message) {
      if (Config.VERBOSITY) { throw Error(message); }
      if (Config.LOGERRORS && console && console.log) {
        console.log(message);
      }
    },

  Config = {
    CACHING: false,
    ESCAPECHR: true,
    NON_ASCII: true,
    SELECTOR3: true,
    UNICODE16: true,
    SHORTCUTS: false,
    SIMPLENOT: true,
    SVG_LCASE: false,
    UNIQUE_ID: true,
    USE_HTML5: true,
    VERBOSITY: true,
    LOGERRORS: true
  },

  initialize =
    function(doc) {
      setIdentifierSyntax();
      switchContext(doc, true);
    },

  setIdentifierSyntax =
    function() {

      var syntax = '', start = Config['SELECTOR3'] ? '-{2}|' : '';

      Config['NON_ASCII'] && (syntax += '|' + non_asc_chr);
      Config['UNICODE16'] && (syntax += '|' + unicode_chr);
      Config['ESCAPECHR'] && (syntax += '|' + escaped_chr);

      syntax += (Config['UNICODE16'] || Config['ESCAPECHR']) ? '' : '|' + any_esc_chr;

      identifier = '-?(?:' + start + alphalodash + syntax + ')(?:-|[0-9]|' + alphalodash + syntax + ')*';

      attrcheck = '(' + quotedvalue + '|' + identifier + ')';
      attributes = whitespace + '*(' + identifier + '(?::' + identifier + ')?)' +
        whitespace + '*(?:' + operators + whitespace + '*' + attrcheck + ')?' + whitespace + '*' + '(i)?' + whitespace + '*';
      attrmatcher = attributes.replace(attrcheck, '([\\x22\\x27]*)((?:\\\\?.)*?)\\3');

      pseudoclass = '((?:' +
        pseudoparms + '|' + quotedvalue + '|' +
        prefixes + identifier + '|' +
        '\\[' + attributes + '\\]|' +
        '\\(.+\\)|' + whitespace + '*|' +
        ',)+)';

      standardValidator =
        '(?=[\\x20\\t\\n\\r\\f]*[^>+~(){}<>])' +
        '(' +
        '\\*' +
        '|(?:' + prefixes + identifier + ')' +
        '|' + combinators +
        '|\\[' + attributes + '\\]' +
        '|\\(' + pseudoclass + '\\)' +
        '|\\{' + extensions + '\\}' +
        '|(?:,|' + whitespace + '*)' +
        ')+';

      reSimpleNot = RegExp('^(' +
        '(?!:not)' +
        '(' + prefixes + identifier +
        '|\\([^()]*\\))+' +
        '|\\[' + attributes + '\\]' +
        ')$');

      reSplitToken = RegExp('(' +
        prefixes + identifier + '|' +
        '\\[' + attributes + '\\]|' +
        '\\(' + pseudoclass + '\\)|' +
        '\\\\.|[^\\x20\\t\\n\\r\\f>+~])+', 'g');

      reOptimizeSelector = RegExp(identifier + '|^$');

      Optimize = {
        ID: RegExp('^\\*?#(' + identifier + ')|' + skip_groups),
        TAG: RegExp('^(' + identifier + ')|' + skip_groups),
        CLASS: RegExp('^\\.(' + identifier + '$)|' + skip_groups)
      };

      Patterns.id = RegExp('^#(' + identifier + ')(.*)');
      Patterns.tagName = RegExp('^(' + identifier + ')(.*)');
      Patterns.className = RegExp('^\\.(' + identifier + ')(.*)');
      Patterns.attribute = RegExp('^\\[' + attrmatcher + '\\](.*)');

      Tokens.identifier = identifier;
      Tokens.attributes = attributes;

      extendedValidator = standardValidator.replace(pseudoclass, '.*');

      reValidator = RegExp(standardValidator);
    },

  ACCEPT_NODE = 'r[r.length]=c[k];if(f&&false===f(c[k]))break main;else continue main;',
  REJECT_NODE = IE_LT_9 ? 'if(e.nodeName<"A")continue;' : '',
  TO_UPPER_CASE = IE_LT_9 ? '.toUpperCase()' : '',

  compile =
    function(selector, source, mode) {

      var parts = typeof selector == 'string' ? selector.match(reSplitGroup) : selector;

      typeof source == 'string' || (source = '');

      if (parts.length == 1) {
        source += compileSelector(parts[0], mode ? ACCEPT_NODE : 'f&&f(k);return true;', mode);
      } else {
        var i = -1, seen = { }, token;
        while ((token = parts[++i])) {
          token = token.replace(reTrimSpaces, '');
          if (!seen[token] && (seen[token] = true)) {
            source += compileSelector(token, mode ? ACCEPT_NODE : 'f&&f(k);return true;', mode);
          }
        }
      }

      if (mode) {
        return Function('c,s,d,h,g,f',
          'var N,n,x=0,k=-1,e,r=[];main:while((e=c[++k])){' + source + '}return r;');
      } else {
        return Function('e,s,d,h,g,f',
          'var N,n,x=0,k=e;' + source + 'return false;');
      }
    },

  compileSelector =
    function(selector, source, mode) {

      var a, b, n, k = 0, expr, match, result, status, test, type;

      while (selector) {

        k++;

        if ((match = selector.match(Patterns.universal))) {
          expr = '';
        }

        else if ((match = selector.match(Patterns.id))) {
          match[1] = (/\\/).test(match[1]) ? convertEscapes(match[1]) : match[1];
          source = 'if(' + (XML_DOCUMENT ?
            's.getAttribute(e,"id")' :
            '(e.submit?s.getAttribute(e,"id"):e.id)') +
            '=="' + match[1] + '"' +
            '){' + source + '}';
        }

        else if ((match = selector.match(Patterns.tagName))) {
          test = Config.SVG_LCASE ? '||e.nodeName=="' + match[1].toLowerCase() + '"' : '';
          source = 'if(e.nodeName' + (XML_DOCUMENT ?
            '=="' + match[1] + '"' : TO_UPPER_CASE +
            '=="' + match[1].toUpperCase() + '"' + test) +
            '){' + source + '}';
        }

        else if ((match = selector.match(Patterns.className))) {
          match[1] = (/\\/).test(match[1]) ? convertEscapes(match[1]) : match[1];
          match[1] = QUIRKS_MODE ? match[1].toLowerCase() : match[1];
          source = 'if((n=' + (XML_DOCUMENT ?
            'e.getAttribute("class")' : 'e.className') +
            ')&&n.length&&(" "+' + (QUIRKS_MODE ? 'n.toLowerCase()' : 'n') +
            '.replace(/' + whitespace + '+/g," ")+" ").indexOf(" ' + match[1] + ' ")>-1' +
            '){' + source + '}';
        }

        else if ((match = selector.match(Patterns.attribute))) {
          expr = match[1].split(':');
          expr = expr.length == 2 ? expr[1] : expr[0] + '';

          if (match[2] && !Operators[match[2]]) {
            emit('Unsupported operator in attribute selectors "' + selector + '"');
            return '';
          }
          test = 'false';
          if (match[2] && match[4] && (test = Operators[match[2]])) {
            match[4] = (/\\/).test(match[4]) ? convertEscapes(match[4]) : match[4];
            type = match[5] == 'i' || HTML_TABLE[expr.toLowerCase()];
            test = test.replace(/\%m/g, type ? match[4].toLowerCase() : match[4]);
          } else if (match[2] == '!=' || match[2] == '=') {
            test = 'n' + match[2] + '=""';
          }
          source = 'if(n=s.hasAttribute(e,"' + match[1] + '")){' +
            (match[2] ? 'n=s.getAttribute(e,"' + match[1] + '")' : '') +
            (type && match[2] ? '.toLowerCase();' : ';') +
            'if(' + (match[2] ? test : 'n') + '){' + source + '}}';
        }

        else if ((match = selector.match(Patterns.adjacent))) {
          source = NATIVE_TRAVERSAL_API ?
            'var N' + k + '=e;if((e=e.previousElementSibling)){' + source + '}e=N' + k + ';' :
            'var N' + k + '=e;while((e=e.previousSibling)){if(e.nodeType==1){' + source + 'break;}}e=N' + k + ';';
        }

        else if ((match = selector.match(Patterns.relative))) {
          source = NATIVE_TRAVERSAL_API ?
            'var N' + k + '=e;while((e=e.previousElementSibling)){' + source + '}e=N' + k + ';' :
            'var N' + k + '=e;while((e=e.previousSibling)){if(e.nodeType==1){' + source + '}}e=N' + k + ';';
        }

        else if ((match = selector.match(Patterns.children))) {
          source = 'var N' + k + '=e;if((e=e.parentNode)&&e.nodeType==1){' + source + '}e=N' + k + ';';
        }

        else if ((match = selector.match(Patterns.ancestor))) {
          source = 'var N' + k + '=e;while((e=e.parentNode)&&e.nodeType==1){' + source + '}e=N' + k + ';';
        }

        else if ((match = selector.match(Patterns.spseudos)) && match[1]) {
          switch (match[1]) {
            case 'root':
              if (match[3]) {
                source = 'if(e===h||s.contains(h,e)){' + source + '}';
              } else {
                source = 'if(e===h){' + source + '}';
              }
              break;
            case 'empty':
              source = 'if(s.isEmpty(e)){' + source + '}';
              break;
            default:
              if (match[1] && match[2]) {
                if (match[2] == 'n') {
                  source = 'if(e!==h){' + source + '}';
                  break;
                } else if (match[2] == 'even') {
                  a = 2;
                  b = 0;
                } else if (match[2] == 'odd') {
                  a = 2;
                  b = 1;
                } else {
                  b = ((n = match[2].match(/(-?\d+)$/)) ? parseInt(n[1], 10) : 0);
                  a = ((n = match[2].match(/(-?\d*)n/i)) ? parseInt(n[1], 10) : 0);
                  if (n && n[1] == '-') a = -1;
                }
                test = a > 1 ?
                  (/last/i.test(match[1])) ? '(n-(' + b + '))%' + a + '==0' :
                  'n>=' + b + '&&(n-(' + b + '))%' + a + '==0' : a < -1 ?
                  (/last/i.test(match[1])) ? '(n-(' + b + '))%' + a + '==0' :
                  'n<=' + b + '&&(n-(' + b + '))%' + a + '==0' : a === 0 ?
                  'n==' + b : a == -1 ? 'n<=' + b : 'n>=' + b;
                source =
                  'if(e!==h){' +
                    'n=s[' + (/-of-type/i.test(match[1]) ? '"nthOfType"' : '"nthElement"') + ']' +
                      '(e,' + (/last/i.test(match[1]) ? 'true' : 'false') + ');' +
                    'if(' + test + '){' + source + '}' +
                  '}';
              } else {
                a = /first/i.test(match[1]) ? 'previous' : 'next';
                n = /only/i.test(match[1]) ? 'previous' : 'next';
                b = /first|last/i.test(match[1]);
                type = /-of-type/i.test(match[1]) ? '&&n.nodeName!=e.nodeName' : '&&n.nodeName<"@"';
                source = 'if(e!==h){' +
                  ( 'n=e;while((n=n.' + a + 'Sibling)' + type + ');if(!n){' + (b ? source :
                    'n=e;while((n=n.' + n + 'Sibling)' + type + ');if(!n){' + source + '}') + '}' ) + '}';
              }
              break;
          }
        }

        else if ((match = selector.match(Patterns.dpseudos)) && match[1]) {
          switch (match[1].match(/^\w+/)[0]) {
            case 'matches':
              expr = match[3].replace(reTrimSpaces, '');
              source = 'if(s.match(e, "' + expr.replace(/\x22/g, '\\"') + '",g)){' + source +'}';
              break;

            case 'not':
              expr = match[3].replace(reTrimSpaces, '');
              if (Config.SIMPLENOT && !reSimpleNot.test(expr)) {
                emit('Negation pseudo-class only accepts simple selectors "' + selector + '"');
                return '';
              } else {
                if ('compatMode' in doc) {
                  source = 'if(!' + compile(expr, '', false) + '(e,s,d,h,g)){' + source + '}';
                } else {
                  source = 'if(!s.match(e, "' + expr.replace(/\x22/g, '\\"') + '",g)){' + source +'}';
                }
              }
              break;
            case 'checked':
              source = 'if((typeof e.form!=="undefined"&&(/^(?:radio|checkbox)$/i).test(e.type)&&e.checked)' +
                (Config.USE_HTML5 ? '||(/^option$/i.test(e.nodeName)&&(e.selected||e.checked))' : '') +
                '){' + source + '}';
              break;
            case 'disabled':
              source = 'if(((typeof e.form!=="undefined"' +
                (Config.USE_HTML5 ? '' : '&&!(/^hidden$/i).test(e.type)') +
                ')||s.isLink(e))&&e.disabled===true){' + source + '}';
              break;
            case 'enabled':
              source = 'if(((typeof e.form!=="undefined"' +
                (Config.USE_HTML5 ? '' : '&&!(/^hidden$/i).test(e.type)') +
                ')||s.isLink(e))&&e.disabled===false){' + source + '}';
              break;
            case 'lang':
              test = '';
              if (match[2]) test = match[2].substr(0, 2) + '-';
              source = 'do{(n=e.lang||"").toLowerCase();' +
                'if((n==""&&h.lang=="' + match[2].toLowerCase() + '")||' +
                '(n&&(n=="' + match[2].toLowerCase() +
                '"||n.substr(0,3)=="' + test.toLowerCase() + '")))' +
                '{' + source + 'break;}}while((e=e.parentNode)&&e!==g);';
              break;
            case 'target':
              source = 'if(e.id==d.location.hash.slice(1)){' + source + '}';
              break;
            case 'link':
              source = 'if(s.isLink(e)&&!e.visited){' + source + '}';
              break;
            case 'visited':
              source = 'if(s.isLink(e)&&e.visited){' + source + '}';
              break;
            case 'active':
              source = 'if(e===d.activeElement){' + source + '}';
              break;
            case 'hover':
              source = 'if(e===d.hoverElement){' + source + '}';
              break;
            case 'focus':
              source = 'hasFocus' in doc ?
                'if(e===d.activeElement&&d.hasFocus()&&(e.type||e.href||typeof e.tabIndex=="number")){' + source + '}' :
                'if(e===d.activeElement&&(e.type||e.href)){' + source + '}';
              break;
            case 'selected':
              source = 'if(/^option$/i.test(e.nodeName)&&(e.selected||e.checked)){' + source + '}';
              break;
            default:
              break;
          }
        }

        else if ((match = selector.match(Patterns.epseudos)) && match[1]) {
          source = 'if(!(/1|11/).test(e.nodeType)){' + source + '}';
        }

        else {

          expr = false;
          status = false;
          for (expr in Selectors) {
            if ((match = selector.match(Selectors[expr].Expression)) && match[1]) {
              result = Selectors[expr].Callback(match, source);
              if ('match' in result) { match = result.match; }
              source = result.source;
              status = result.status;
              if (status) { break; }
            }
          }

          if (!status) {
            emit('Unknown pseudo-class selector "' + selector + '"');
            return '';
          }

          if (!expr) {
            emit('Unknown token in selector "' + selector + '"');
            return '';
          }

        }

        if (!match) {
          emit('Invalid syntax in selector "' + selector + '"');
          return '';
        }

        selector = match && match[match.length - 1];
      }

      return source;
    },

  match =
    function(element, selector, from, callback) {

      var parts;

      if (!(element && element.nodeType == 1)) {
        emit('Invalid element argument');
        return false;
      } else if (typeof selector != 'string') {
        emit('Invalid selector argument');
        return false;
      } else if (lastContext !== from) {
        switchContext(from || (from = element.ownerDocument));
      }

      selector = selector.
        replace(reTrimSpaces, '').
        replace(/\x00|\\$/g, '\ufffd');

      Config.SHORTCUTS && (selector = Dom.shortcuts(selector, element, from));

      if (lastMatcher != selector) {
        if ((parts = selector.match(reValidator)) && parts[0] == selector) {
          isSingleMatch = (parts = selector.match(reSplitGroup)).length < 2;
          lastMatcher = selector;
          lastPartsMatch = parts;
        } else {
          emit('The string "' + selector + '", is not a valid CSS selector');
          return false;
        }
      } else parts = lastPartsMatch;

      if (!matchResolvers[selector] || matchContexts[selector] !== from) {
        matchResolvers[selector] = compile(isSingleMatch ? [selector] : parts, '', false);
        matchContexts[selector] = from;
      }

      return matchResolvers[selector](element, Snapshot, doc, root, from, callback);
    },

  first =
    function(selector, from) {
      return select(selector, from, function() { return false; })[0] || null;
    },

  select =
    function(selector, from, callback) {

      var i, changed, element, elements, parts, token, original = selector;

      if (arguments.length === 0) {
        emit('Not enough arguments');
        return [ ];
      } else if (typeof selector != 'string') {
        return [ ];
      } else if (from && !(/1|9|11/).test(from.nodeType)) {
        emit('Invalid or illegal context element');
        return [ ];
      } else if (lastContext !== from) {
        switchContext(from || (from = doc));
      }

      if (Config.CACHING && (elements = Dom.loadResults(original, from, doc, root))) {
        return callback ? concatCall([ ], elements, callback) : elements;
      }

      selector = selector.
        replace(reTrimSpaces, '').
        replace(/\x00|\\$/g, '\ufffd');

      Config.SHORTCUTS && (selector = Dom.shortcuts(selector, from));

      if ((changed = lastSelector != selector)) {
        if ((parts = selector.match(reValidator)) && parts[0] == selector) {
          isSingleSelect = (parts = selector.match(reSplitGroup)).length < 2;
          lastSelector = selector;
          lastPartsSelect = parts;
        } else {
          emit('The string "' + selector + '", is not a valid CSS selector');
          return [ ];
        }
      } else parts = lastPartsSelect;

      if (from.nodeType == 11) {

        elements = byTagRaw('*', from);

      } else if (isSingleSelect) {

        if (changed) {
          parts = selector.match(reSplitToken);
          token = parts[parts.length - 1];
          lastSlice = token.split(':not');
          lastSlice = lastSlice[lastSlice.length - 1];
          lastPosition = selector.length - token.length;
        }

        if (Config.UNIQUE_ID && lastSlice && (parts = lastSlice.match(Optimize.ID)) && (token = parts[1])) {
          if ((element = _byId(token, from))) {
            if (match(element, selector)) {
              callback && callback(element);
              elements = [element];
            } else elements = [ ];
          }
        }

        else if (Config.UNIQUE_ID && (parts = selector.match(Optimize.ID)) && (token = parts[1])) {
          if ((element = _byId(token, doc))) {
            if ('#' + token == selector) {
              callback && callback(element);
              elements = [element];
            } else if (/[>+~]/.test(selector)) {
              from = element.parentNode;
            } else {
              from = element;
            }
          } else elements = [ ];
        }

        if (elements) {
          Config.CACHING && Dom.saveResults(original, from, doc, elements);
          return elements;
        }

        if (!XML_DOCUMENT && GEBTN && lastSlice && (parts = lastSlice.match(Optimize.TAG)) && (token = parts[1])) {
          if ((elements = from.getElementsByTagName(token)).length === 0) { return [ ]; }
          selector = selector.slice(0, lastPosition) + selector.slice(lastPosition).replace(token, '*');
        }

        else if (!XML_DOCUMENT && GEBCN && lastSlice && (parts = lastSlice.match(Optimize.CLASS)) && (token = parts[1])) {
          if ((elements = from.getElementsByClassName(unescapeIdentifier(token))).length === 0) { return [ ]; }
            selector = selector.slice(0, lastPosition) + selector.slice(lastPosition).replace('.' + token,
              reOptimizeSelector.test(selector.charAt(selector.indexOf(token) - 1)) ? '' : '*');
        }

      }

      if (!elements) {
        if (IE_LT_9) {
          elements = /^(?:applet|object)$/i.test(from.nodeName) ? from.children : byTagRaw('*', from);
        } else {
          elements = from.getElementsByTagName('*');
        }
      }

      if (!selectResolvers[selector] || selectContexts[selector] !== from) {
        selectResolvers[selector] = compile(isSingleSelect ? [selector] : parts, REJECT_NODE, true);
        selectContexts[selector] = from;
      }

      elements = selectResolvers[selector](elements, Snapshot, doc, root, from, callback);

      Config.CACHING && Dom.saveResults(original, from, doc, elements);

      return elements;
    },

  FN = function(x) { return x; },

  matchContexts = { },
  matchResolvers = { },

  selectContexts = { },
  selectResolvers = { },

  Snapshot = {
    byId: _byId,
    match: match,
    select: select,
    isLink: isLink,
    isEmpty: isEmpty,
    contains: contains,
    nthOfType: nthOfType,
    nthElement: nthElement,
    getAttribute: getAttribute,
    hasAttribute: hasAttribute
  },

  Dom = {

    ACCEPT_NODE: ACCEPT_NODE,

    byId: byId,
    match: match,
    first: first,
    select: select,
    compile: compile,
    contains: contains,
    configure: configure,
    getAttribute: getAttribute,
    hasAttribute: hasAttribute,

    setCache: FN,
    shortcuts: FN,
    loadResults: FN,
    saveResults: FN,

    emit: emit,
    Config: Config,
    Snapshot: Snapshot,

    Operators: Operators,
    Selectors: Selectors,

    Tokens: Tokens,
    Version: version,

    registerOperator:
      function(symbol, resolver) {
        Operators[symbol] || (Operators[symbol] = resolver);
      },

    registerSelector:
      function(name, rexp, func) {
        Selectors[name] || (Selectors[name] = {
          Expression: rexp,
          Callback: func
        });
      }

  };

  initialize(doc);

  return Dom;
});
