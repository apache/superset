'use strict';

function factory (type, config, load, typed) {
  /**
   * @constructor UpdateNode
   */
  function UpdateNode() {
    // TODO: deprecated since v3. Cleanup some day
    throw new Error('UpdateNode is deprecated. Use AssignmentNode instead.');
  }

  return UpdateNode;
}

exports.name = 'UpdateNode';
exports.path = 'expression.node';
exports.factory = factory;
