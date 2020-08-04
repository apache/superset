'use strict';

var parser = require('./lib/parser');
var processingInstructions = require('./lib/processing-instructions');
var isValidNodeDefinitions = require('./lib/is-valid-node-definitions');
var processNodeDefinitions = require('./lib/process-node-definitions');

module.exports = {
  Parser: parser,
  ProcessingInstructions: processingInstructions,
  IsValidNodeDefinitions: isValidNodeDefinitions,
  ProcessNodeDefinitions: processNodeDefinitions,
};
