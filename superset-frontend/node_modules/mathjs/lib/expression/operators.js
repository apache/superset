'use strict'

//list of identifiers of nodes in order of their precedence
//also contains information about left/right associativity
//and which other operator the operator is associative with
//Example:
// addition is associative with addition and subtraction, because:
// (a+b)+c=a+(b+c)
// (a+b)-c=a+(b-c)
//
// postfix operators are left associative, prefix operators 
// are right associative
//
//It's also possible to set the following properties:
// latexParens: if set to false, this node doesn't need to be enclosed
//              in parentheses when using LaTeX
// latexLeftParens: if set to false, this !OperatorNode's! 
//                  left argument doesn't need to be enclosed
//                  in parentheses
// latexRightParens: the same for the right argument
var properties = [
  { //assignment
    'AssignmentNode': {},
    'FunctionAssignmentNode': {}
  },
  { //conditional expression
    'ConditionalNode': {
      latexLeftParens: false,
      latexRightParens: false,
      latexParens: false
      //conditionals don't need parentheses in LaTeX because
      //they are 2 dimensional
    }
  },
  { //logical or
    'OperatorNode:or': {
      associativity: 'left',
      associativeWith: []
    }

  },
  { //logical xor
    'OperatorNode:xor': {
      associativity: 'left',
      associativeWith: []
    }
  },
  { //logical and
    'OperatorNode:and': {
      associativity: 'left',
      associativeWith: []
    }
  },
  { //bitwise or
    'OperatorNode:bitOr': {
      associativity: 'left',
      associativeWith: []
    }
  },
  { //bitwise xor
    'OperatorNode:bitXor': {
      associativity: 'left',
      associativeWith: []
    }
  },
  { //bitwise and
    'OperatorNode:bitAnd': {
      associativity: 'left',
      associativeWith: []
    }
  },
  { //relational operators
    'OperatorNode:equal': {
      associativity: 'left',
      associativeWith: []
    },
    'OperatorNode:unequal': {
      associativity: 'left',
      associativeWith: []
    },
    'OperatorNode:smaller': {
      associativity: 'left',
      associativeWith: []
    },
    'OperatorNode:larger': {
      associativity: 'left',
      associativeWith: []
    },
    'OperatorNode:smallerEq': {
      associativity: 'left',
      associativeWith: []
    },
    'OperatorNode:largerEq': {
      associativity: 'left',
      associativeWith: []
    }
  },
  { //bitshift operators
    'OperatorNode:leftShift': {
      associativity: 'left',
      associativeWith: []
    },
    'OperatorNode:rightArithShift': {
      associativity: 'left',
      associativeWith: []
    },
    'OperatorNode:rightLogShift': {
      associativity: 'left',
      associativeWith: []
    }
  },
  { //unit conversion
    'OperatorNode:to': {
      associativity: 'left',
      associativeWith: []
    }
  },
  { //range
    'RangeNode': {}
  },
  { //addition, subtraction
    'OperatorNode:add': {
      associativity: 'left',
      associativeWith: ['OperatorNode:add', 'OperatorNode:subtract']
    },
    'OperatorNode:subtract': {
      associativity: 'left',
      associativeWith: []
    }
  },
  { //multiply, divide, modulus
    'OperatorNode:multiply': {
      associativity: 'left',
      associativeWith: [
        'OperatorNode:multiply',
        'OperatorNode:divide',
        'Operator:dotMultiply',
        'Operator:dotDivide'
      ]
    },
    'OperatorNode:divide': {
      associativity: 'left',
      associativeWith: [],
      latexLeftParens: false,
      latexRightParens: false,
      latexParens: false
      //fractions don't require parentheses because
      //they're 2 dimensional, so parens aren't needed
      //in LaTeX
    },
    'OperatorNode:dotMultiply': {
      associativity: 'left',
      associativeWith: [
        'OperatorNode:multiply',
        'OperatorNode:divide',
        'OperatorNode:dotMultiply',
        'OperatorNode:doDivide'
      ]
    },
    'OperatorNode:dotDivide': {
      associativity: 'left',
      associativeWith: []
    },
    'OperatorNode:mod': {
      associativity: 'left',
      associativeWith: []
    }
  },
  { //unary prefix operators
    'OperatorNode:unaryPlus': {
      associativity: 'right'
    },
    'OperatorNode:unaryMinus': {
      associativity: 'right'
    },
    'OperatorNode:bitNot': {
      associativity: 'right'
    },
    'OperatorNode:not': {
      associativity: 'right'
    }
  },
  { //exponentiation
    'OperatorNode:pow': {
      associativity: 'right',
      associativeWith: [],
      latexRightParens: false
      //the exponent doesn't need parentheses in
      //LaTeX because it's 2 dimensional
      //(it's on top)
    },
    'OperatorNode:dotPow': {
      associativity: 'right',
      associativeWith: []
    }
  },
  { //factorial
    'OperatorNode:factorial': {
      associativity: 'left'
    }
  },
  { //matrix transpose
    'OperatorNode:transpose': {
      associativity: 'left'
    }
  }
];

/**
 * Get the precedence of a Node.
 * Higher number for higher precedence, starting with 0.
 * Returns null if the precedence is undefined.
 *
 * @param {Node}
 * @param {string} parenthesis
 * @return {number|null}
 */
function getPrecedence (_node, parenthesis) {
  var node = _node;
  if (parenthesis !== 'keep') {
    //ParenthesisNodes are only ignored when not in 'keep' mode
    node = _node.getContent();
  }
  var identifier = node.getIdentifier();
  for (var i = 0; i < properties.length; i++) {
    if (identifier in properties[i]) {
      return i;
    }
  }
  return null;
}

/**
 * Get the associativity of an operator (left or right).
 * Returns a string containing 'left' or 'right' or null if
 * the associativity is not defined.
 *
 * @param {Node}
 * @param {string} parenthesis
 * @return {string|null}
 * @throws {Error}
 */
function getAssociativity (_node, parenthesis) {
  var node = _node;
  if (parenthesis !== 'keep') {
    //ParenthesisNodes are only ignored when not in 'keep' mode
    node = _node.getContent();
  }
  var identifier = node.getIdentifier();
  var index = getPrecedence(node, parenthesis);
  if (index === null) {
    //node isn't in the list
    return null;
  }
  var property = properties[index][identifier];

  if (property.hasOwnProperty('associativity')) {
    if (property.associativity === 'left') {
      return 'left';
    }
    if (property.associativity === 'right') {
      return 'right';
    }
    //associativity is invalid
    throw Error('\'' + identifier + '\' has the invalid associativity \''
                + property.associativity + '\'.');
  }

  //associativity is undefined
  return null;
}

/**
 * Check if an operator is associative with another operator.
 * Returns either true or false or null if not defined.
 *
 * @param {Node} nodeA
 * @param {Node} nodeB
 * @param {string} parenthesis
 * @return {bool|null}
 */
function isAssociativeWith (nodeA, nodeB, parenthesis) {
  var a = nodeA;
  var b = nodeB;
  if (parenthesis !== 'keep') {
    //ParenthesisNodes are only ignored when not in 'keep' mode
    var a = nodeA.getContent();
    var b = nodeB.getContent();
  }
  var identifierA = a.getIdentifier();
  var identifierB = b.getIdentifier();
  var index = getPrecedence(a, parenthesis);
  if (index === null) {
    //node isn't in the list
    return null;
  }
  var property = properties[index][identifierA];

  if (property.hasOwnProperty('associativeWith')
      && (property.associativeWith instanceof Array)) {
    for (var i = 0; i < property.associativeWith.length; i++) {
      if (property.associativeWith[i] === identifierB) {
        return true;
      }
    }
    return false;
  }

  //associativeWith is not defined
  return null;
}

module.exports.properties = properties;
module.exports.getPrecedence = getPrecedence;
module.exports.getAssociativity = getAssociativity;
module.exports.isAssociativeWith = isAssociativeWith;
