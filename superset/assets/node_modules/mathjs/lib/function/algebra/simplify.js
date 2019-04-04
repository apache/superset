'use strict';


function factory (type, config, load, typed, math) {
  var parse = load(require('../../expression/parse'));
  var ConstantNode = load(require('../../expression/node/ConstantNode'));
  var FunctionNode = load(require('../../expression/node/FunctionNode'));
  var OperatorNode = load(require('../../expression/node/OperatorNode'));
  var ParenthesisNode = load(require('../../expression/node/ParenthesisNode'));
  var SymbolNode = load(require('../../expression/node/SymbolNode'));
  var Node = load(require('../../expression/node/Node'));
  var simplifyConstant = load(require('./simplify/simplifyConstant'));
  var simplifyCore = load(require('./simplify/simplifyCore'));
  var resolve = load(require('./simplify/resolve'));

  var util = load(require('./simplify/util'));
  var isCommutative = util.isCommutative;
  var isAssociative = util.isAssociative;
  var flatten = util.flatten;
  var unflattenr = util.unflattenr;
  var unflattenl = util.unflattenl;
  var createMakeNodeFunction = util.createMakeNodeFunction;

  /**
   * Simplify an expression tree.
   *
   * A list of rules are applied to an expression, repeating over the list until
   * no further changes are made.
   * It's possible to pass a custom set of rules to the function as second
   * argument. A rule can be specified as an object, string, or function:
   *
   *     var rules = [
   *       { l: 'n1*n3 + n2*n3', r: '(n1+n2)*n3' },
   *       'n1*n3 + n2*n3 -> (n1+n2)*n3',
   *       function (node) {
   *         // ... return a new node or return the node unchanged
   *         return node
   *       }
   *     ]
   *
   * String and object rules consist of a left and right pattern. The left is
   * used to match against the expression and the right determines what matches
   * are replaced with. The main difference between a pattern and a normal
   * expression is that variables starting with the following characters are
   * interpreted as wildcards:
   *
   * - 'n' - matches any Node
   * - 'c' - matches any ConstantNode
   * - 'v' - matches any Node that is not a ConstantNode
   *
   * The default list of rules is exposed on the function as `simplify.rules`
   * and can be used as a basis to built a set of custom rules.
   *
   * For more details on the theory, see:
   *
   * - [Strategies for simplifying math expressions (Stackoverflow)](http://stackoverflow.com/questions/7540227/strategies-for-simplifying-math-expressions)
   * - [Symbolic computation - Simplification (Wikipedia)](https://en.wikipedia.org/wiki/Symbolic_computation#Simplification)
   *
   * Syntax:
   *
   *     simplify(expr)
   *     simplify(expr, rules)
   *     simplify(expr, rules, scope)
   *     simplify(expr, scope)
   *
   * Examples:
   *
   *     math.simplify('2 * 1 * x ^ (2 - 1)');      // Node {2 * x}
   *     math.simplify('2 * 3 * x', {x: 4});        // Node {24}
   *     var f = math.parse('2 * 1 * x ^ (2 - 1)');
   *     math.simplify(f);                          // Node {2 * x}
   *
   * See also:
   *
   *     derivative, parse, eval
   *
   * @param {Node | string} expr
   *            The expression to be simplified
   * @param {Array<{l:string, r: string} | string | function>} [rules]
   *            Optional list with custom rules
   * @return {Node} Returns the simplified form of `expr`
   */
  var simplify = typed('simplify', {
    'string': function (expr) {
      return simplify(parse(expr), simplify.rules, {});
    },

    'string, Object': function (expr, scope) {
      return simplify(parse(expr), simplify.rules, scope);
    },

    'string, Array': function (expr, rules) {
      return simplify(parse(expr), rules, {});
    },

    'string, Array, Object': function (expr, rules, scope) {
      return simplify(parse(expr), rules, scope);
    },

    'Node, Object': function (expr, scope) {
      return simplify(expr, simplify.rules, scope);
    },

    'Node': function (expr) {
      return simplify(expr, simplify.rules, {});
    },

    'Node, Array': function (expr, rules) {
      return simplify(expr, rules, {});
    },

    'Node, Array, Object': function (expr, rules, scope) {
      rules = _buildRules(rules);

      var res = resolve(expr, scope);
      var res = removeParens(res);
      var visited = {};

      var str = res.toString({parenthesis: 'all'});
      while(!visited[str]) {
        visited[str] = true;
        _lastsym = 0; // counter for placeholder symbols
        for (var i=0; i<rules.length; i++) {
          if (typeof rules[i] === 'function') {
            res = rules[i](res);
          }
          else {
            flatten(res);
            res = applyRule(res, rules[i]);
          }
          unflattenl(res); // using left-heavy binary tree here since custom rule functions may expect it
        }
        str = res.toString({parenthesis: 'all'});
      }

      return res;
    }
  });
  simplify.simplifyCore = simplifyCore;
  simplify.resolve = resolve;

  function removeParens(node) {
    return node.transform(function(node, path, parent) {
      return type.isParenthesisNode(node)
          ? node.content
          : node;
    });
  }

  // All constants that are allowed in rules
  var SUPPORTED_CONSTANTS = {
    true: true,
    false: true,
    e: true,
    i: true,
    Infinity: true,
    LN2: true,
    LN10: true,
    LOG2E: true,
    LOG10E: true,
    NaN: true,
    phi: true,
    pi: true,
    SQRT1_2: true,
    SQRT2: true,
    tau: true,
    // null: false,
    // uninitialized: false,
    // version: false,
  };

  // Array of strings, used to build the ruleSet.
  // Each l (left side) and r (right side) are parsed by
  // the expression parser into a node tree.
  // Left hand sides are matched to subtrees within the
  // expression to be parsed and replaced with the right
  // hand side.
  // TODO: Add support for constraints on constants (either in the form of a '=' expression or a callback [callback allows things like comparing symbols alphabetically])
  // To evaluate lhs constants for rhs constants, use: { l: 'c1+c2', r: 'c3', evaluate: 'c3 = c1 + c2' }. Multiple assignments are separated by ';' in block format.
  // It is possible to get into an infinite loop with conflicting rules
  simplify.rules = [
    simplifyCore,
    //{ l: 'n+0', r: 'n' },     // simplifyCore
    //{ l: 'n^0', r: '1' },     // simplifyCore
    //{ l: '0*n', r: '0' },     // simplifyCore
    //{ l: 'n/n', r: '1'},      // simplifyCore
    //{ l: 'n^1', r: 'n' },     // simplifyCore
    //{ l: '+n1', r:'n1' },     // simplifyCore
    //{ l: 'n--n1', r:'n+n1' }, // simplifyCore
    { l: 'log(e)', r:'1' },

    // temporary rules
    { l: 'n-n1', r:'n+-n1' }, // temporarily replace 'subtract' so we can further flatten the 'add' operator
    { l: '-(c*v)', r: '(-c) * v' }, // make non-constant terms positive
    { l: '-v', r: '(-1) * v' },
    { l: 'n/n1^n2', r:'n*n1^-n2' }, // temporarily replace 'divide' so we can further flatten the 'multiply' operator
    { l: 'n/n1', r:'n*n1^-1' },

    // expand nested exponentiation
    { l: '(n ^ n1) ^ n2', r: 'n ^ (n1 * n2)'},

    // collect like factors
    { l: 'n*n', r: 'n^2' },
    { l: 'n * n^n1', r: 'n^(n1+1)' },
    { l: 'n^n1 * n^n2', r: 'n^(n1+n2)' },

    // collect like terms
    { l: 'n+n', r: '2*n' },
    { l: 'n+-n', r: '0' },
    { l: 'n1*n2 + n2', r: '(n1+1)*n2' },
    { l: 'n1*n3 + n2*n3', r: '(n1+n2)*n3' },

    // remove parenthesis in the case of negating a quantitiy
    { l: 'n1 + -1 * (n2 + n3)', r:'n1 + -1 * n2 + -1 * n3' },

    simplifyConstant,

    { l: '(-n)*n1', r: '-(n*n1)' }, // make factors positive (and undo 'make non-constant terms positive')

    // ordering of constants
    { l: 'c+v', r: 'v+c', context: { 'add': { commutative:false } } },
    { l: 'v*c', r: 'c*v', context: { 'multiply': { commutative:false } } },

    // undo temporary rules
    //{ l: '(-1) * n', r: '-n' }, // #811 added test which proved this is redundant
    { l: 'n+-n1', r:'n-n1' },  // undo replace 'subtract'
    { l: 'n*(n1^-1)', r:'n/n1' },  // undo replace 'divide'
    { l: 'n*n1^-n2', r:'n/n1^n2' },
    { l: 'n1^-1', r:'1/n1' },

    { l: 'n*(n1/n2)', r:'(n*n1)/n2' }, // '*' before '/'
    { l: 'n-(n1+n2)', r:'n-n1-n2' }, // '-' before '+'
    // { l: '(n1/n2)/n3', r: 'n1/(n2*n3)' },
    // { l: '(n*n1)/(n*n2)', r: 'n1/n2' },

    { l: '1*n', r: 'n' } // this pattern can be produced by simplifyConstant

  ];

  /**
   * Parse the string array of rules into nodes
   *
   * Example syntax for rules:
   *
   * Position constants to the left in a product:
   * { l: 'n1 * c1', r: 'c1 * n1' }
   * n1 is any Node, and c1 is a ConstantNode.
   *
   * Apply difference of squares formula:
   * { l: '(n1 - n2) * (n1 + n2)', r: 'n1^2 - n2^2' }
   * n1, n2 mean any Node.
   *
   * Short hand notation:
   * 'n1 * c1 -> c1 * n1'
   */
  function _buildRules(rules) {
    // Array of rules to be used to simplify expressions
    var ruleSet = [];
    for(var i=0; i<rules.length; i++) {
      var rule = rules[i];
      var newRule;
      var ruleType = typeof rule;
      switch (ruleType) {
        case 'string':
          var lr = rule.split('->');
          if (lr.length !== 2) {
            throw SyntaxError('Could not parse rule: ' + rule);
          }
          rule = {l: lr[0], r: lr[1]};
          /* falls through */
        case 'object':
          newRule = {
            l: removeParens(parse(rule.l)),
            r: removeParens(parse(rule.r)),
          }
          if(rule.context) {
            newRule.evaluate = rule.context;
          }
          if(rule.evaluate) {
            newRule.evaluate = parse(rule.evaluate);
          }

          if (isAssociative(newRule.l)) {
            var makeNode = createMakeNodeFunction(newRule.l);
            var expandsym = _getExpandPlaceholderSymbol();
            newRule.expanded = {};
            newRule.expanded.l = makeNode([newRule.l.clone(), expandsym]);
            // Push the expandsym into the deepest possible branch.
            // This helps to match the newRule against nodes returned from getSplits() later on.
            flatten(newRule.expanded.l);
            unflattenr(newRule.expanded.l);
            newRule.expanded.r = makeNode([newRule.r, expandsym]);
          }
          break;
        case 'function':
          newRule = rule;
          break;
        default:
          throw TypeError('Unsupported type of rule: ' + ruleType);
      }
     // console.log('Adding rule: ' + rules[i]);
     // console.log(newRule);
      ruleSet.push(newRule);
    }
    return ruleSet;
  }

  var _lastsym = 0;
  function _getExpandPlaceholderSymbol() {
    return new SymbolNode('_p' + _lastsym++);
  }

  /**
   * Returns a simplfied form of node, or the original node if no simplification was possible.
   *
   * @param  {ConstantNode | SymbolNode | ParenthesisNode | FunctionNode | OperatorNode} node
   * @return {ConstantNode | SymbolNode | ParenthesisNode | FunctionNode | OperatorNode} The simplified form of `expr`, or the original node if no simplification was possible.
   */
  var applyRule = typed('applyRule', {
    'Node, Object': function (node, rule) {

      //console.log('Entering applyRule(' + node.toString() + ')');

      // Do not clone node unless we find a match
      var res = node;

      // First replace our child nodes with their simplified versions
      // If a child could not be simplified, the assignments will have
      // no effect since the node is returned unchanged
      if (res instanceof OperatorNode || res instanceof FunctionNode) {
        if (res.args) {
          for(var i=0; i<res.args.length; i++) {
            res.args[i] = applyRule(res.args[i], rule);
          }
        }
      }
      else if(res instanceof ParenthesisNode) {
        if(res.content) {
          res.content = applyRule(res.content, rule);
        }
      }

      // Try to match a rule against this node
      var repl = rule.r;
      var matches = _ruleMatch(rule.l, res)[0];

      // If the rule is associative operator, we can try matching it while allowing additional terms.
      // This allows us to match rules like 'n+n' to the expression '(1+x)+x' or even 'x+1+x' if the operator is commutative.
      if (!matches && rule.expanded) {
        repl = rule.expanded.r;
        matches = _ruleMatch(rule.expanded.l, res)[0];
      }

      if (matches) {
        // var before = res.toString({parenthesis: 'all'});

        // Create a new node by cloning the rhs of the matched rule
        res = repl.clone();

        // Replace placeholders with their respective nodes without traversing deeper into the replaced nodes
        var _transform = function(node) {
          if(node.isSymbolNode && matches.placeholders.hasOwnProperty(node.name)) {
            return matches.placeholders[node.name].clone();
          }
          else {
            return node.map(_transform);
          }
        }

        res = _transform(res);

        // var after = res.toString({parenthesis: 'all'});
        // console.log('Simplified ' + before + ' to ' + after);
      }

      return res;
    }
  });

  /**
   * Get (binary) combinations of a flattened binary node
   * e.g. +(node1, node2, node3) -> [
   *        +(node1,  +(node2, node3)),
   *        +(node2,  +(node1, node3)),
   *        +(node3,  +(node1, node2))]
   *
   */
  function getSplits(node, context) {
    var res = [];
    var right, rightArgs;
    var makeNode = createMakeNodeFunction(node);
    if (isCommutative(node, context)) {
      for (var i=0; i<node.args.length; i++) {
        rightArgs = node.args.slice(0);
        rightArgs.splice(i, 1);
        right = (rightArgs.length === 1) ? rightArgs[0] : makeNode(rightArgs);
        res.push(makeNode([node.args[i], right]));
      }
    }
    else {
      rightArgs = node.args.slice(1);
      right = (rightArgs.length === 1) ? rightArgs[0] : makeNode(rightArgs);
      res.push(makeNode([node.args[0], right]));
    }
    return res;
  }

  /**
   * Returns the set union of two match-placeholders or null if there is a conflict.
   */
  function mergeMatch(match1, match2) {
    var res = {placeholders:{}};

    // Some matches may not have placeholders; this is OK
    if (!match1.placeholders && !match2.placeholders) {
      return res;
    }
    else if (!match1.placeholders) {
      return match2;
    }
    else if (!match2.placeholders) {
      return match1;
    }

    // Placeholders with the same key must match exactly
    for (var key in match1.placeholders) {
      res.placeholders[key] = match1.placeholders[key];
      if (match2.placeholders.hasOwnProperty(key)) {
        if (!_exactMatch(match1.placeholders[key], match2.placeholders[key] )) {
          return null;
        }
      }
    }

    for (var key in match2.placeholders) {
      res.placeholders[key] = match2.placeholders[key];
    }

    return res;
  }

  /**
   * Combine two lists of matches by applying mergeMatch to the cartesian product of two lists of matches.
   * Each list represents matches found in one child of a node.
   */
  function combineChildMatches(list1, list2) {
    var res = [];

    if (list1.length === 0 || list2.length === 0) {
      return res;
    }

    var merged;
    for (var i1 = 0; i1 < list1.length; i1++) {
      for (var i2 = 0; i2 < list2.length; i2++) {
        merged = mergeMatch(list1[i1], list2[i2]);
        if (merged) {
          res.push(merged);
        }
      }
    }
    return res;
  }

  /**
   * Combine multiple lists of matches by applying mergeMatch to the cartesian product of two lists of matches.
   * Each list represents matches found in one child of a node.
   * Returns a list of unique matches.
   */
  function mergeChildMatches(childMatches) {
    if (childMatches.length === 0) {
      return childMatches;
    }

    var sets = childMatches.reduce(combineChildMatches);
    var uniqueSets = [];
    var unique = {};
    for(var i = 0; i < sets.length; i++) {
      var s = JSON.stringify(sets[i]);
      if (!unique[s]) {
        unique[s] = true;
        uniqueSets.push(sets[i]);
      }
    }
    return uniqueSets;
  }

  /**
   * Determines whether node matches rule.
   *
   * @param {ConstantNode | SymbolNode | ParenthesisNode | FunctionNode | OperatorNode} rule
   * @param {ConstantNode | SymbolNode | ParenthesisNode | FunctionNode | OperatorNode} node
   * @return {Object} Information about the match, if it exists.
   */
  function _ruleMatch(rule, node, isSplit) {
//    console.log('Entering _ruleMatch(' + JSON.stringify(rule) + ', ' + JSON.stringify(node) + ')');
//    console.log('rule = ' + rule);
//    console.log('node = ' + node);

//    console.log('Entering _ruleMatch(' + rule.toString() + ', ' + node.toString() + ')');
    var res = [{placeholders:{}}];

    if (rule instanceof OperatorNode && node instanceof OperatorNode
     || rule instanceof FunctionNode && node instanceof FunctionNode) {

      // If the rule is an OperatorNode or a FunctionNode, then node must match exactly
      if (rule instanceof OperatorNode) {
        if (rule.op !== node.op || rule.fn !== node.fn) {
          return [];
        }
      }
      else if (rule instanceof FunctionNode) {
        if (rule.name !== node.name) {
          return [];
        }
      }

      // rule and node match. Search the children of rule and node.
      if (node.args.length === 1 && rule.args.length === 1 || !isAssociative(node) || isSplit) {
        // Expect non-associative operators to match exactly
        var childMatches = [];
        for (var i = 0; i < rule.args.length; i++) {
          var childMatch = _ruleMatch(rule.args[i], node.args[i]);
          if (childMatch.length === 0) {
            // Child did not match, so stop searching immediately
            return [];
          }
          // The child matched, so add the information returned from the child to our result
          childMatches.push(childMatch);
        }
        res = mergeChildMatches(childMatches);
      }
      else if (node.args.length >= 2 && rule.args.length === 2) { // node is flattened, rule is not
        // Associative operators/functions can be split in different ways so we check if the rule matches each
        // them and return their union.
        var splits = getSplits(node, rule.context);
        var splitMatches = [];
        for(var i = 0; i < splits.length; i++) {
          var matchSet = _ruleMatch(rule, splits[i], true); // recursing at the same tree depth here
          splitMatches = splitMatches.concat(matchSet);
        }
        return splitMatches;
      }
      else if (rule.args.length > 2) {
        throw Error('Unexpected non-binary associative function: ' + rule.toString());
      }
      else {
        // Incorrect number of arguments in rule and node, so no match
        return [];
      }
    }
    else if (rule instanceof SymbolNode) {
      // If the rule is a SymbolNode, then it carries a special meaning
      // according to the first character of the symbol node name.
      // c.* matches a ConstantNode
      // n.* matches any node
      if (rule.name.length === 0) {
        throw new Error('Symbol in rule has 0 length...!?');
      }
     if (math.hasOwnProperty(rule.name)) {
        if (!SUPPORTED_CONSTANTS[rule.name]) {
          throw new Error('Built in constant: ' + rule.name + ' is not supported by simplify.');
        }

        // built-in constant must match exactly
        if(rule.name !== node.name) {
          return [];
        }
      }
      else if (rule.name[0] === 'n' || rule.name.substring(0,2) === '_p') {
        // rule matches _anything_, so assign this node to the rule.name placeholder
        // Assign node to the rule.name placeholder.
        // Our parent will check for matches among placeholders.
        res[0].placeholders[rule.name] = node;
      }
      else if (rule.name[0] === 'v') {
        // rule matches any variable thing (not a ConstantNode)
        if(!type.isConstantNode(node)) {
          res[0].placeholders[rule.name] = node;
        }
        else {
          // Mis-match: rule was expecting something other than a ConstantNode
          return [];
        }
      }
      else if (rule.name[0] === 'c') {
        // rule matches any ConstantNode
        if(node instanceof ConstantNode) {
          res[0].placeholders[rule.name] = node;
        }
        else {
          // Mis-match: rule was expecting a ConstantNode
          return [];
        }
      }
      else {
        throw new Error('Invalid symbol in rule: ' + rule.name);
      }
    }
    else if (rule instanceof ConstantNode) {
      // Literal constant must match exactly
      if(rule.value !== node.value) {
        return [];
      }
    }
    else {
      // Some other node was encountered which we aren't prepared for, so no match
      return [];
    }

    // It's a match!

    // console.log('_ruleMatch(' + rule.toString() + ', ' + node.toString() + ') found a match');
    return res;
  }


  /**
   * Determines whether p and q (and all their children nodes) are identical.
   *
   * @param {ConstantNode | SymbolNode | ParenthesisNode | FunctionNode | OperatorNode} p
   * @param {ConstantNode | SymbolNode | ParenthesisNode | FunctionNode | OperatorNode} q
   * @return {Object} Information about the match, if it exists.
   */
  function _exactMatch(p, q) {
    if(p instanceof ConstantNode && q instanceof ConstantNode) {
      if(p.value !== q.value) {
        return false;
      }
    }
    else if(p instanceof SymbolNode && q instanceof SymbolNode) {
      if(p.name !== q.name) {
        return false;
      }
    }
    else if(p instanceof OperatorNode && q instanceof OperatorNode
         || p instanceof FunctionNode && q instanceof FunctionNode) {
      if (p instanceof OperatorNode) {
        if (p.op !== q.op || p.fn !== q.fn) {
          return false;
        }
      }
      else if (p instanceof FunctionNode) {
        if (p.name !== q.name) {
          return false;
        }
      }

      if(p.args.length !== q.args.length) {
        return false;
      }

      for(var i=0; i<p.args.length; i++) {
        if(!_exactMatch(p.args[i], q.args[i])) {
          return false;
        }
      }
    }
    else {
      return false;
    }

    return true;
  }

  return simplify;
}

exports.math = true;
exports.name = 'simplify';
exports.factory = factory;
