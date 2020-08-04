/**
 * @fileoverview Rule to flag use of .only blocks in tests
 * @author Levi Buzolic
 */

"use strict";

//------------------------------------------------------------------------------
// Rule Definition
//------------------------------------------------------------------------------

module.exports = {
  meta: {
    docs: {
      description: "disallow .only blocks in tests",
      category: "Possible Errors",
    }
  },

  create(context) {
    const regex = /^(describe|it|context|test|tape|fixture)$/;

    return {
      Identifier: function(node) {
        if (node.name === 'only' && node.parent && node.parent.object && regex.test(node.parent.object.name)) {
          context.report(node, node.parent.object.name + '.only not permitted');
        }
      }
    }
  }
};
