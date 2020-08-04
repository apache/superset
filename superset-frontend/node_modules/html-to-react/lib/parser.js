'use strict';
var forEach = require('ramda/src/forEach');
var find = require('ramda/src/find');
var reject = require('ramda/src/reject');
var addIndex = require('ramda/src/addIndex');
var map = require('ramda/src/map');
var HtmlParser = require('htmlparser2').Parser;
var DomHandler = require('domhandler').DomHandler;
var ProcessingInstructions = require('./processing-instructions');
var IsValidNodeDefinitions = require('./is-valid-node-definitions');
var utils = require('./utils');

function Html2ReactParser(options) {
  function parseHtmlToTree(html) {
    options = options || {};
    options.decodeEntities = true;
    var handler = new DomHandler();
    var parser = new HtmlParser(handler, options);
    parser.parseComplete(html);
    return handler.dom.filter(function (element) {
      return element.type !== 'directive';
    });
  };

  function traverseDom(node, isValidNode, processingInstructions, preprocessingInstructions,
    index) {
    if (isValidNode(node)) {
      forEach(function (preprocessingInstruction) {
        if (preprocessingInstruction.shouldPreprocessNode(node)) {
          preprocessingInstruction.preprocessNode(node, index);
        }
      }, preprocessingInstructions || []);

      var processingInstruction = find(function (processingInstruction) {
        return processingInstruction.shouldProcessNode(node);
      }, processingInstructions || []);
      if (processingInstruction != null) {
        var children = reject(function (x) {return x == null || x === false;},
          addIndex(map)(function (child, i) {
            return traverseDom(child, isValidNode, processingInstructions,
              preprocessingInstructions, i);
          }, node.children || []));

        if (processingInstruction.replaceChildren) {
          return utils.createElement(node, index, node.data, [
            processingInstruction.processNode(node, children, index),
          ]);
        } else {
          return processingInstruction.processNode(node, children, index);
        }
      } else {
        return false;
      }
    } else {
      return false;
    }
  };

  function parseWithInstructions(html, isValidNode, processingInstructions,
      preprocessingInstructions) {
    var domTree = parseHtmlToTree(html);
    var list = domTree.map(function (domTreeItem, index) {
      return traverseDom(domTreeItem, isValidNode, processingInstructions,
        preprocessingInstructions, index);
    });
    return list.length <= 1 ? list[0] : list;
  };

  function parse(html) {
    var processingInstructions = new ProcessingInstructions();
    return parseWithInstructions(html,
      IsValidNodeDefinitions.alwaysValid,
      processingInstructions.defaultProcessingInstructions);
  };

  return {
    parse: parse,
    parseWithInstructions: parseWithInstructions,
  };
};

module.exports = Html2ReactParser;
