var math = require('../../index');

// Filter an expression tree
console.log('Filter all symbol nodes "x" in the expression "x^2 + x/4 + 3*y"');
var node = math.parse('x^2 + x/4 + 3*y');
var filtered = node.filter(function (node) {
  return node.isSymbolNode && node.name == 'x';
});
// returns an array with two entries: two SymbolNodes 'x'

filtered.forEach(function (node) {
  console.log(node.type, node.toString())
});
// outputs:
//  SymbolNode x
//  SymbolNode x


// Traverse an expression tree
console.log();
console.log('Traverse the expression tree of expression "3 * x + 2"');
var node1 = math.parse('3 * x + 2');
node1.traverse(function (node, path, parent) {
  switch (node.type) {
    case 'OperatorNode': console.log(node.type, node.op);    break;
    case 'ConstantNode': console.log(node.type, node.value); break;
    case 'SymbolNode':   console.log(node.type, node.name);  break;
    default:             console.log(node.type);
  }
});
// outputs:
//   OperatorNode +
//   OperatorNode *
//   ConstantNode 3
//   SymbolNode x
//   ConstantNode 2


// transform an expression tree
console.log();
console.log('Replace all symbol nodes "x" in expression "x^2 + 5*x" with a constant 3');
var node2 = math.parse('x^2 + 5*x');
var transformed = node2.transform(function (node, path, parent) {
  if (node.isSymbolNode && node.name == 'x') {
    return new math.expression.node.ConstantNode(3);
  }
  else {
    return node;
  }
});
console.log(transformed.toString());
// outputs: '(3 ^ 2) + (5 * 3)'

