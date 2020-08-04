var falafel = require('../');
var test = require('tape');
var semver = require('semver');

// acorn-jsx requires node 4
test('custom parser', { skip: semver.satisfies(process.version, '< 4.0.0') },function (t) {
  var acorn = require('acorn');
  var jsx = require('acorn-jsx');
  var acornWithJsx = acorn.Parser.extend(jsx());

  var src = '(function() { var f = {a: "b"}; var a = <div {...f} className="test"></div>; })()';

  var nodeTypes = [
    'Identifier',
    'Identifier',
    'Literal',
    'Property',
    'ObjectExpression',
    'VariableDeclarator',
    'VariableDeclaration',
    'Identifier',
    'Identifier',
    'JSXSpreadAttribute',
    'JSXIdentifier',
    'Literal',
    'JSXAttribute',
    'JSXIdentifier',
    'JSXOpeningElement',
    'JSXIdentifier',
    'JSXClosingElement',
    'JSXElement',
    'VariableDeclarator',
    'VariableDeclaration',
    'BlockStatement',
    'FunctionExpression',
    'CallExpression',
    'ExpressionStatement',
    'Program'
  ];

  t.plan(nodeTypes.length);

  var output = falafel(src, {parser: acornWithJsx, ecmaVersion: 6, plugins: { jsx: true }}, function(node) {
    t.equal(node.type, nodeTypes.shift());
  });
});
