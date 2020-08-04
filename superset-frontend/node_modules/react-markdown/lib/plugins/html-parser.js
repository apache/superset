"use strict";

/**
 * Full blown HTML parsing based on htmlparser2.
 * Pulls in a heavy set of dependencies and thus WILL bloat your bundle size.
 * You have been warned.
 **/
var React = require('react');

var xtend = require('xtend');

var visit = require('unist-util-visit');

var HtmlToReact = require('html-to-react');

var symbols = require('../symbols');

var type = 'parsedHtml';
var selfClosingRe = /^<(area|base|br|col|embed|hr|img|input|keygen|link|meta|param|source|track|wbr)\s*\/?>$/i;
var startTagRe = /^<([a-z]+)\b/i;
var closingTagRe = /^<\/([a-z]+)\s*>$/;
var parser = new HtmlToReact.Parser();
var processNodeDefinitions = new HtmlToReact.ProcessNodeDefinitions(React);
var defaultConfig = {
  isValidNode: function isValidNode(node) {
    return node.type !== 'script';
  },
  processingInstructions: [{
    shouldProcessNode: function shouldProcessNode() {
      return true;
    },
    processNode: processNodeDefinitions.processDefaultNode
  }]
};

function parseHtml(config, tree, props) {
  var open;
  var currentParent;
  visit(tree, 'html', function (node, index, parent) {
    if (props.escapeHtml) {
      parent.children.splice(index, 1, {
        type: 'text',
        position: node.position,
        value: node.value
      });
      return true;
    }

    if (props.skipHtml) {
      parent.children.splice(index, 1);
      return true;
    }

    if (currentParent !== parent) {
      open = [];
      currentParent = parent;
    }

    var selfClosing = getSelfClosingTagName(node);

    if (selfClosing) {
      parent.children.splice(index, 1, {
        type: 'virtualHtml',
        tag: selfClosing,
        position: node.position
      });
      return true;
    }

    var current = parseNode(node, config);

    if (!current || current.type === type) {
      return true;
    }

    var matching = findAndPull(open, current.tag);

    if (matching) {
      parent.children.splice(index, 0, parsedHtml(current, matching, parent));
    } else if (!current.opening) {
      open.push(current);
    }

    return true;
  }, true // Iterate in reverse
  ); // Find any leftover HTML elements and blindly replace them with a parsed version

  visit(tree, 'html', function (node, index, parent) {
    var element = parser.parseWithInstructions(node.value, config.isValidNode, config.processingInstructions);

    if (!element) {
      parent.children.splice(index, 1);
      return true;
    }

    parent.children.splice(index, 1, {
      type: type,
      element: element,
      value: node.value,
      position: node.position
    });
    return true;
  });
  return tree;
}

function findAndPull(open, matchingTag) {
  var i = open.length;

  while (i--) {
    if (open[i].tag === matchingTag) {
      return open.splice(i, 1)[0];
    }
  }

  return false;
}

function parseNode(node, config) {
  var match = node.value.trim().match(closingTagRe);

  if (match) {
    return {
      tag: match[1],
      opening: false,
      node: node
    };
  }

  var el = parser.parseWithInstructions(node.value, config.isValidNode, config.processingInstructions);

  if (!el) {
    return false;
  }

  var isMultiple = React.Children.count(el) > 1;
  var isSelfClosing = !isMultiple && selfClosingRe.test("<".concat(el.type, ">"));

  if (isMultiple || isSelfClosing) {
    return {
      type: type,
      position: node.position,
      node: el
    };
  }

  var startTagMatch = node.value.trim().match(startTagRe);
  var tag = startTagMatch ? startTagMatch[1] : el.type;
  return {
    tag: tag,
    opening: true,
    node: node,
    element: el
  };
}

function getSelfClosingTagName(node) {
  var match = node.value.match(selfClosingRe);
  return match ? match[1] : false;
}

function parsedHtml(fromNode, toNode, parent) {
  var fromIndex = parent.children.indexOf(fromNode.node);
  var toIndex = parent.children.indexOf(toNode.node);
  var extracted = parent.children.splice(fromIndex, toIndex - fromIndex + 1);
  var children = extracted.slice(1, -1);
  return {
    type: type,
    children: children,
    tag: fromNode.tag,
    element: fromNode.element,
    value: fromNode.node.value,
    position: {
      start: fromNode.node.position.start,
      end: toNode.node.position.end,
      indent: []
    }
  };
}

module.exports = function getHtmlParserPlugin(config, props) {
  if (props && (typeof config.source !== 'undefined' || typeof config.children !== 'undefined')) {
    throw new Error('react-markdown: `html-parser` must be called before use - see https://github.com/rexxars/react-markdown#parsing-html');
  }

  var htmlConfig = xtend(defaultConfig, config || {});
  var plugin = parseHtml.bind(null, htmlConfig);
  plugin.identity = symbols.HtmlParser;
  return plugin;
};