# Customization

Besides parsing and evaluating expressions, the expression parser supports
a number of features to customize processing and evaluation of expressions
and outputting expressions.

On this page:

- [Function transforms](#function-transforms)
- [Custom argument parsing](#custom-argument-parsing)
- [Custom LaTeX handlers](#custom-latex-handlers)
- [Custom HTML, LaTeX and string output](#custom-html-latex-and-string-output)
- [Customize supported characters](#customize-supported-characters)

## Function transforms

It is possible to preprocess function arguments and post process a functions
return value by writing a *transform* for the function. A transform is a
function wrapping around a function to be transformed or completely replaces
a function.

For example, the functions for math.js use zero-based matrix indices (as is
common in programing languages), but the expression parser uses one-based
indices. To enable this, all functions dealing with indices have a transform,
which changes input from one-based to zero-based, and transforms output (and
error message) from zero-based to one-based.

```js
// using plain JavaScript, indices are zero-based:
var a = [[1, 2], [3, 4]]; // a 2x2 matrix
math.subset(a, math.index(0, 1)); // returns 2

// using the expression parser, indices are transformed to one-based:
var a = [[1, 2], [3, 4]]; // a 2x2 matrix
var scope = {
  a: a
};
math.eval('subset(a, index(1, 2))', scope); // returns 2
```

To create a transform for a function, the transform function must be attached
to the function as property `transform`:

```js
var math = require('../index');

// create a function
function addIt(a, b) {
  return a + b;
}

// attach a transform function to the function addIt
addIt.transform = function (a, b) {
  console.log('input: a=' + a + ', b=' + b);
  // we can manipulate input here before executing addIt

  var res = addIt(a, b);

  console.log('result: ' + res);
  // we can manipulate result here before returning

  return res;
};

// import the function into math.js
math.import({
  addIt: addIt
});

// use the function via the expression parser
console.log('Using expression parser:');
console.log('2+4=' + math.eval('addIt(2, 4)'));
// This will output:
//
//     input: a=2, b=4
//     result: 6
//     2+4=6

// when used via plain JavaScript, the transform is not invoked
console.log('');
console.log('Using plain JavaScript:');
console.log('2+4=' + math.addIt(2, 4));
// This will output:
//
//     6
```

Functions with a transform must be imported in the `math` namespace, as they
need to be processed at compile time. They are not supported when passed via a
scope at evaluation time.


## Custom argument parsing

The expression parser of math.js has support for letting functions
parse and evaluate arguments themselves, instead of calling them with
evaluated arguments. This is useful for example when creating a function
like `plot(f(x), x)` or `integrate(f(x), x, start, end)`, where some of the
arguments need to be processed in a special way. In these cases, the expression
`f(x)` will be evaluated repeatedly by the function, and `x` is not evaluated
but used to specify the variable looping over the function `f(x)`.

Functions having a property `rawArgs` with value `true` are treated in a special
way by the expression parser: they will be invoked with unevaluated arguments,
allowing the function to process the arguments in a customized way. Raw
functions are called as:

```
rawFunction(args: Node[], math: Object, scope: Object)
```

Where :

- `args` is an Array with nodes of the parsed arguments.
- `math` is the math namespace against which the expression was compiled.
- `scope` is the scope provided when evaluating the expression.

Raw functions must be imported in the `math` namespace, as they need to be
processed at compile time. They are not supported when passed via a scope
at evaluation time.

A simple example:

```js
function myFunction(args, math, scope) {
  // get string representation of the arguments
  var str = args.map(function (arg) {
    return arg.toString();
  })

  // evaluate the arguments
  var res = args.map(function (arg) {
    return arg.compile().eval(scope);
  });

  return 'arguments: ' + str.join(',') + ', evaluated: ' + res.join(',');
}

// mark the function as "rawArgs", so it will be called with unevaluated arguments
myFunction.rawArgs = true;

// import the new function in the math namespace
math.import({
  myFunction: myFunction
})

// use the function
math.eval('myFunction(2 + 3, sqrt(4))');
// returns 'arguments: 2 + 3, sqrt(4), evaluated: 5, 2'
```

## Custom LaTeX handlers

You can attach a `toTex` property to your custom functions before importing them to define their LaTeX output. This
`toTex` property can be a handler in the format described in the next section 'Custom LaTeX and String conversion'
or a template string similar to ES6 templates.

### Template syntax

- `${name}`: Gets replaced by the name of the function
- `${args}`: Gets replaced by a comma separated list of the arguments of the function.
- `${args[0]}`: Gets replaced by the first argument of a function
- `$$`: Gets replaced by `$`

#### Example

```js
var customFunctions = {
  plus: function (a, b) {
    return a + b;
  },
  minus: function (a, b) {
    return a - b;
  },
  binom: function (n, k) {
    return 1;
  }
};

customFunctions.plus.toTex = '${args[0]}+${args[1]}'; //template string
customFunctions.binom.toTex = '\\mathrm{${name}}\\left(${args}\\right)'; //template string
customFunctions.minus.toTex = function (node, options) { //handler function
  return node.args[0].toTex(options) + node.name + node.args[1].toTex(options);
};

math.import(customFunctions);

math.parse('plus(1,2)').toTex();    //'1+2'
math.parse('binom(1,2)').toTex();   // '\\mathrm{binom}\\left(1,2\\right)'
math.parse('minus(1,2)').toTex();   // '1minus2'
```

## Custom HTML, LaTeX and string output

All expression nodes have a method `toTex` and `toString` to output an expression respectively in HTML or LaTex format or as regular text .
The functions `toHTML`, `toTex` and `toString` accept an `options` argument to customise output. This object is of the following form:

```js
{
  parenthesis: 'keep',   // parenthesis option
  handler: someHandler,   // handler to change the output
  implicit: 'hide' // how to treat implicit multiplication
}
```

### Parenthesis

The `parenthesis` option changes the way parentheses are used in the output. There are three options available:

- `keep` Keep the parentheses from the input and display them as is. This is the default.
- `auto` Only display parentheses that are necessary. Mathjs tries to get rid of as much parentheses as possible.
- `all` Display all parentheses that are given by the structure of the node tree. This makes the output precedence unambiguous.

There's two ways of passing callbacks:

1. Pass an object that maps function names to callbacks. Those callbacks will be used for FunctionNodes with 
functions of that name.
2. Pass a function to `toTex`. This function will then be used for every node.

```js
var expression = math.parse('(1+1+1)');

expression.toString(); //(1 + 1 + 1)
expression.toString({parenthesis: 'keep'}); //(1 + 1 + 1)
expression.toString({parenthesis: 'auto'}); //1 + 1 + 1
expression.toString({parenthesis: 'all'});  //(1 + 1) + 1
```

### Handler

You can provide the `toTex` and `toString` functions of an expression with your own custom handlers that override the internal behaviour. This is especially useful to provide LaTeX/string output for your own custom functions. This can be done in two ways:

1. Pass an object that maps function names to callbacks. Those callbacks will be used for FunctionNodes that contain functions with that name.
2. Pass a callback directly. This callback will run for every node, so you can replace the output of anything you like.

A callback function has the following form:

```js
var callback = function (node, options) {
  ...
}
```
Where `options` is the object passed to `toHTML`/`toTex`/`toString`. Don't forget to pass this on to the child nodes, and `node` is a reference to the current node.

If a callback returns nothing, the standard output will be used. If your callback returns a string, this string will be used.

**Although the following examples use `toTex`, it works for `toString` and `toHTML` in the same way**

#### Examples for option 1

```js
var customFunctions = {
  binomial: function (n, k) {
    //calculate n choose k
    // (do some stuff)
    return result;
  }
};

var customLaTeX = {
  'binomial': function (node, options) { //provide toTex for your own custom function
    return '\\binom{' + node.args[0].toTex(options) + '}{' + node.args[1].toTex(options) + '}';
  },
  'factorial': function (node, options) { //override toTex for builtin functions
  	return 'factorial\\left(' + node.args[0] + '\\right)';
  }
};
```

You can simply use your custom toTex functions by passing them to `toTex`:

```js
math.import(customFunctions);
var expression = math.parse('binomial(factorial(2),1)');
var latex = expression.toTex({handler: customLaTeX});
//latex now contains "\binom{factorial\\left(2\\right)}{1}"
```

#### Examples for option 2:

```js
var customLaTeX = function (node, options) {
  if ((node.type === 'OperatorNode') && (node.fn === 'add')) {
    //don't forget to pass the options to the toTex functions
    return node.args[0].toTex(options) + ' plus ' + node.args[1].toTex(options);
  }
  else if (node.type === 'ConstantNode') {
    if (node.value == 0) {
        return '\\mbox{zero}';
    }
    else if (node.value == 1) {
        return '\\mbox{one}';
    }
    else if (node.value == 2) {
        return '\\mbox{two}';
    }
    else {
        return node.value;
    }
  }
};

var expression = math.parse('1+2');
var latex = expression.toTex({handler: customLaTeX});
//latex now contains '\mbox{one} plus \mbox{two}'
```

Another example in conjunction with custom functions:

```js
var customFunctions = {
  binomial: function (n, k) {
    //calculate n choose k
    // (do some stuff)
    return result;
  }
};

var customLaTeX = function (node, options) {
  if ((node.type === 'FunctionNode') && (node.name === 'binomial')) {
      return '\\binom{' + node.args[0].toTex(options) + '}{' + node.args[1].toTex(options) + '}';
  }
};

math.import(customFunctions);
var expression = math.parse('binomial(2,1)');
var latex = expression.toTex({handler: customLaTeX});
//latex now contains "\binom{2}{1}"
```

### Implicit multiplication

You can change the way that implicit multiplication is converted to a string or LaTeX. The two options are `hide`, to not show a multiplication operator for implicit multiplication and `show` to show it.

Example:

```js
var node = math.parse('2a');

node.toString(); //'2 a'
node.toString({implicit: 'hide'}); //'2 a'
node.toString({implicit: 'show'}); //'2 * a'

node.toTex(); //'2~ a'
node.toTex({implicit: 'hide'}); //'2~ a'
node.toTex({implicit: 'show'}); //'2\\cdot a'
```


## Customize supported characters

It is possible to customize the characters allowed in symbols and digits.
The `parse` function exposes the following test functions:

- `math.expression.parse.isAlpha(c, cPrev, cNext)`
- `math.expression.parse.isWhitespace(c, nestingLevel)`
- `math.expression.parse.isDecimalMark(c, cNext)`
- `math.expression.parse.isDigitDot(c)`
- `math.expression.parse.isDigit(c)`

The exact signature and implementation of these functions can be looked up in
the [source code of the parser](https://github.com/josdejong/mathjs/blob/master/lib/expression/parse.js). The allowed alpha characters are described here: [Constants and variables](syntax.md#constants-and-variables).

For example, the phone character <code>&#9742;</code> is not supported by default. It can be enabled
by replacing the `isAlpha` function:

```js
var isAlphaOriginal = math.expression.parse.isAlpha;
math.expression.parse.isAlpha = function (c, cPrev, cNext) {
  return isAlphaOriginal(c, cPrev, cNext) || (c === '\u260E');
};

// now we can use the \u260E (phone) character in expressions
var result = math.eval('\u260Efoo', {'\u260Efoo': 42}); // returns 42
console.log(result);
```
