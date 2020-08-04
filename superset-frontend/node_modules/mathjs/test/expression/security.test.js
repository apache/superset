var assert = require('assert');
var math = require('../../index');

describe('security', function () {

  it ('should not allow calling Function via constructor', function () {
    assert.throws(function () {
      math.eval('[].map.constructor("console.log(\'hacked...\')")()');
    }, /Error: Cannot access method "map" as a property/);
  })

  it ('should not allow calling Function via constructor (2)', function () {
    assert.throws(function () {
      math.eval('sqrt.constructor("console.log(\'hacked...\')")()');
    }, /Error: No access to method "constructor"/);
  })

  it ('should not allow calling Function via call/apply', function () {
    assert.throws(function () {
      math.eval('[].map.constructor.call(null, "console.log(\'hacked...\')")()');
    }, /Error: Cannot access method "map" as a property/);

    assert.throws(function () {
      math.eval('[].map.constructor.apply(null, ["console.log(\'hacked...\')"])()');
    }, /Error: Cannot access method "map" as a property/);
  })

  it ('should not allow calling constructor of a class', function () {
    assert.throws(function () {
      math.eval('[].constructor()');
    }, /Error: No access to method "constructor"/);
  })

  it ('should not allow calling constructor', function () {
    assert.throws(function () {
      math.eval('constructor');
    }, /Error: No access to property "constructor"/);

    assert.throws(function () {
      math.eval('toString');
    }, /Cannot access method "toString" as a property/);
  })

  it ('should not allow calling Function via constructor', function () {
    assert.throws(function () {
      math.eval('[].map.constructor("console.log(\'hacked...\')")()');
    }, /Error: Cannot access method "map" as a property/);

    assert.throws(function () {
      math.eval('[].map["constructor"]("console.log(\'hacked...\')")()');
    }, /Error: Cannot access method "map" as a property/);
  })

  it ('should not allow calling Function via a disguised constructor', function () {
    assert.throws(function () {
      math.eval('prop="constructor"; [].map[prop]("console.log(\'hacked...\')")()');
    }, /Error: Cannot access method "map" as a property/);

    assert.throws(function () {
      math.eval('[].map[concat("constr", "uctor")]("console.log(\'hacked...\')")()');
    }, /Error: Cannot access method "map" as a property/);
  })

  it ('should not allow calling Function via bind', function () {
    assert.throws(function () {
      math.eval('[].map.constructor.bind()("console.log(\'hacked...\')")()');
    }, /Error: Cannot access method "map" as a property/);
  })

  it ('should not allow calling Function via map/forEach', function () {
    // TODO: simplify this test case, let it output console.log('hacked...')
    assert.throws(function () {
      math.eval('["//","a/*\\nreturn process.mainModule.require"]._data.map(cos.constructor)[1]()("child_process").execSync("ps >&2")');
    }, /Error: No access to property "_data/);
  })

  it ('should not allow calling Function via Object.assign', function () {
    // TODO: simplify this test case, let it output console.log('hacked...')
    assert.throws(function () {
      math.eval('{}.constructor.assign(cos.constructor, {binding: cos.bind})\n' +
          '{}.constructor.assign(cos.constructor, {bind: null})\n' +
          'cos.constructor.binding()("console.log(\'hacked...\')")()');
    }, /Error: No access to property "bind/);
  })

  it ('should not allow disguising forbidden properties with unicode characters', function () {
    var scope = {
      a: {}
    };

    assert.throws(function () { math.eval('a.co\u006Estructor', scope); }, /Error: No access to property "constructor"/);
    assert.throws(function () { math.eval('a["co\\u006Estructor"]', scope); }, /Error: No access to property "constructor"/);
    assert.throws(function () { math.eval('a.constructor', scope); }, /Error: No access to property "constructor"/);
    assert.throws(function () { math.eval('a.constructor = 2', scope); }, /Error: No access to property "constructor"/);
    assert.throws(function () { math.eval('a["constructor"] = 2', scope); }, /Error: No access to property "constructor"/);
    assert.throws(function () { math.eval('a["co\\u006Estructor"] = 2', scope); }, /Error: No access to property "constructor"/);
    assert.throws(function () { math.eval('a = {"constructor": 2}', scope); }, /Error: No access to property "constructor"/);
    assert.throws(function () { math.eval('a = {constructor: 2}', scope); }, /Error: No access to property "constructor"/);
    assert.throws(function () { math.eval('a = {"co\\u006Estructor": 2}', scope); }, /Error: No access to property "constructor"/);
    assert.throws(function () { math.eval('a = {co\u006Estructor: 2}', scope); }, /Error: No access to property "constructor"/);
  })

  it ('should not allow calling Function via imported, overridden function', function () {
    assert.throws(function () {
      var math2 = math.create();
      math2.eval('import({matrix:cos.constructor},{override:1});x=["console.log(\'hacked...\')"];x()');
    }, /Error: Undefined symbol import/);
  })

  it ('should not allow calling Function via index retrieval', function () {
    assert.throws(function () {
      math.eval('a=["console.log(\'hacked...\')"]._data;a.isRange=true;x={subset:cos.constructor}[a];x()');
    }, /Error: No access to property "_data/);
  })

  it ('should not allow calling Function via getOwnPropertyDescriptor', function () {
    assert.throws(function () {
      math.eval('p = parser()\n' +
          'p.eval("", [])\n' +
          'o = p.get("constructor")\n' +
          'c = o.getOwnPropertyDescriptor(o.__proto__, "constructor")\n' +
          'c.value("console.log(\'hacked...\')")()');
    }, /Error: No access to property "constructor"/);
  })

  it ('should not allow calling Function via a symbol', function () {
    assert.throws(function () {
      math.eval('O = {}.constructor\n' +
          'd = O.getOwnPropertyDescriptor(O.__proto__, "constructor")\n' +
          'eval("value", d)("console.log(\'hacked...\')")()');
    }, /Error: No access to property "constructor/);
  })

  it ('should not allow calling Function via a specially encoded constructor property name', function () {
    assert.throws(function () {
      math.eval('[].map["\\x63onstructor"]("console.log(\'hacked...\')")()');
    }, /Error: Cannot access method "map" as a property/);
  })

  it ('should not allow creating an Object with forbidden properties', function () {
    assert.throws(function () {
      math.eval('{hasOwnProperty: 2}');
    }, /Error: No access to property "hasOwnProperty/);

    assert.throws(function () {
      math.eval('{constructor: 2}');
    }, /Error: No access to property "constructor/);

    assert.throws(function () {
      math.eval('{toString: 2}');
    }, /Error: No access to property "toString/);
  })

  it ('should not allow calling Object via a an object constructor', function () {
    assert.throws(function () {
            math.eval('{}.constructor.assign(expression.node.AssignmentNode.prototype, ' +
                '{_compile: "".toString.bind("console.log(\'hacked...\')")})\n' +
                'eval("a = 2")');
    }, /Error: No access to property "constructor/);
  })

  it ('should not allow calling Object via a __defineGetter__', function () {
    assert.throws(function () {
      math.eval('expression.node.AssignmentNode.prototype.__defineGetter__("_compile", ' +
          '{}.valueOf.bind("".toString.bind("console.log(\'hacked...\')"))); eval("a = 2")')
    }, /Error: Undefined symbol expression/);
  })

  it ('should not allow calling eval via a custom compiled SymbolNode', function () {
    assert.throws(function () {
      math.eval("s={};s.__proto__=expression.node.SymbolNode[\"prototype\"];expression.node.SymbolNode.apply(s,[\"\\\");},\\\"exec\\\":function(a){return global.eval}};//\"]._data);s.compile().exec()(\"console.log(\'hacked...\')\")")
    }, /Error: Undefined symbol expression/);
  })

  it ('should not allow calling eval via parse', function () {
    assert.throws(function () {
      math.eval('x=parse(\"cos\");x.name = \"\\\");},\\\"eval\\\": function(a) {return global.eval}};\/\/a\"; x.compile().eval()(\"console.log(\'hacked...\')\")')
    }, /No access to property "name"/);
  })

  it ('should not allow calling eval via parse (2)', function () {
    assert.throws(function () {
      math.eval('p = parse("{}[\\"console.log(\'hacked...\')\\"]"); p.index.dimensions["0"].valueType = "boolean"; p.eval()')
    }, /No access to property "index"/);
  })

  it ('should not allow calling eval via function.syntax', function () {
    assert.throws(function () {
      math.eval('cos.syntax="global.eval";s=unit("5 cm");s.units=[]._data;s.value=cos;s._compile=s.toString;expression.node.Node.prototype.compile.call(s).eval()("console.log(\'hacked...\')")')
    }, /Error: No access to property "syntax"/);
  })

  it ('should not allow calling eval via clone', function () {
    assert.throws(function () {
      math.eval('expression.node.ConstantNode.prototype.clone.call({"value":"eval", "valueType":"null"}).eval()("console.log(\'hacked...\')")')
    }, /Error: Undefined symbol expression/);
  })

  it ('should not allow replacing _compile', function () {
    assert.throws(function () {
      math.eval('c(x,y)="console.log(\'hacked...\')";expression.node.Node.prototype.compile.apply({_compile:c}).eval()')
    }, /Error: Undefined symbol expression/);
  })

  it ('should not allow using restricted properties via subset (1)', function () {
    assert.throws(function () {
      math.eval('f()=false;' +
          'g()={length:3};' +
          'h()={"0":0,"1":0,"2":0};' +
          'j(x)=[x("constructor")];' +
          'k(x)={map:j};' +
          'i={isIndex:true,isScalar:f,size:g,min:h,max:h,dimension:k};' +
          'subset(subset([[[0]]],i),index(1,1,1))("console.log(\'hacked...\')")()')
    }, /TypeError: Unexpected type of argument in function subset \(expected: Index, actual: Object, index: 1\)/);
  })

  it ('should not allow using restricted properties via subset (2)', function () {
    assert.throws(function () {
      math.eval("scope={}; setter = eval(\"f(obj, name, newValue, assign) = (obj[name] = newValue)\", scope); o = parse(\"1\"); setter(o, \"value\", \"eval\", subset); scope.obj.compile().eval()(\"console.log('hacked...')\")")
    }, /Error: Undefined symbol name/);
  })

  it ('should not allow using restricted properties via subset (3)', function () {
    assert.throws(function () {
      math.eval('subset(parse("1"), index("value"), "eval").compile().eval()("console.log(\'hacked...\')")')
    }, /Error: No access to property "value/);
  })

  it ('should not allow inserting fake nodes with bad code via node.map or node.transform', function () {
    assert.throws(function () {
      math.eval("badValue = {\"isNode\": true, \"_compile\": eval(\"f(a, b) = \\\"eval\\\"\")}; x = eval(\"f(child, path, parent) = path ==\\\"value\\\" ? newChild : child\", {\"newChild\": badValue}); parse(\"x = 1\").map(x).compile().eval()(\"console.log(\'hacked\')\")")
    }, /TypeError: Callback function must return a Node/);

    assert.throws(function () {
      math.eval("badValue = {\"isNode\": true, \"type\": \"ConstantNode\", \"valueType\": \"string\", \"_compile\": eval(\"f(a, b) = \\\"eval\\\"\")}; x = eval(\"f(child, path, parent) = path ==\\\"value\\\" ? newChild : child\", {\"newChild\": badValue}); parse(\"x = 1\").map(x).compile().eval()(\"console.log(\'hacked...\')\")")
    }); // The error message is vague but well...
  })

  it ('should not allow replacing validateSafeMethod with a local variant', function () {
    assert.throws(function () {
      math.eval("eval(\"f(validateSafeMethod)=cos.constructor(\\\"return eval\\\")()\")(eval(\"f(x,y)=0\"))(\"console.log('hacked...')\")")
    }, /Error: No access to method "constructor"/);
  })

  it ('should not allow abusing toString', function () {
    assert.throws(function () {
      math.eval("badToString = eval(\"f() = 1\"); badReplace = eval(\"f(a, b) = \\\"eval\\\"\"); badNumber = {toString:badToString, replace:badReplace}; badNode = {\"isNode\": true, \"type\": \"ConstantNode\", \"valueType\": \"number\", \"value\": badNumber}; x = eval(\"f(child, path, parent) = badNode\", {badNode:badNode}); parse(\"(1)\").map(x).compile().eval()(\"console.log('hacked...')\")")
    }, /Error: No access to property "toString"/);
  })

  it ('should not allow creating a bad FunctionAssignmentNode', function () {
    assert.throws(function () {
      math.eval("badNode={isNode:true,type:\"FunctionAssignmentNode\",expr:parse(\"1\"),types:{join:eval(\"f(a)=\\\"\\\"\")},params:{\"forEach\":eval(\"f(x)=1\"),\"join\":eval(\"f(x)=\\\"){return eval;}});return fn;})())}});return fn;})());}};//\\\"\")}};parse(\"f()=x\").map(eval(\"f(a,b,c)=badNode\",{\"badNode\":badNode})).compile().eval()()()(\"console.log('hacked...')\")")
    }, /TypeError: Callback function must return a Node/);
  })

  it ('should not allow creating a bad OperatorNode (1)', function () {
    assert.throws(function () {
      math.eval("badNode={isNode:true,type:\"FunctionAssignmentNode\",expr:parse(\"1\"),types:{join:eval(\"f(a)=\\\"\\\"\")},params:{\"forEach\":eval(\"f(x)=1\"),\"join\":eval(\"f(x)=\\\"){return eval;}});return fn;})())}});return fn;})());}};//\\\"\")}};parse(\"f()=x\").map(eval(\"f(a,b,c)=badNode\",{\"badNode\":badNode})).compile().eval()()()(\"console.log('hacked...')\")")
    }, /TypeError: Callback function must return a Node/);
  })

  it ('should not allow creating a bad OperatorNode (2)', function () {
    assert.throws(function () {
      math.eval("parse(\"(0)\").map(eval(\"f(a,b,c)=d\",{d:{isNode:true,type:\"OperatorNode\",fn:\"__lookupGetter__\",args:{map:eval(\"f(a)=b\",{b:{join:eval(\"f(a)=\\\"1)||eval;}};//\\\"\")}})}}})).compile().eval()(\"console.log('hacked...')\")")
    }, /TypeError: Node expected for parameter "content"/);
  })

  it ('should not allow creating a bad ConstantNode', function () {
    assert.throws(function () {
      math.eval('f(x,y)="eval";g()=3;fakeConstantNode={"isNode": true, "type": "ConstantNode", "valueType": "number", "value": {"replace": f, "toString": g}};injectFakeConstantNode(child,path,parent)=path=="value"?fakeConstantNode:child;parse("a=3").map(injectFakeConstantNode).compile().eval()("console.log(\'hacked...\')")')
    }, /Error: No access to property "toString"/);
  })

  it ('should not allow creating a bad ArrayNode', function () {
    assert.throws(function () {
      math.eval('g(x)="eval";f(x)=({join: g});fakeArrayNode={isNode: true, type: "ArrayNode", items: {map: f}};injectFakeArrayNode(child,path,parent)=path=="value"?fakeArrayNode:child;parse("a=3").map(injectFakeArrayNode).compile().eval()[1]("console.log(\'hacked...\')")')
    }, /TypeError: Callback function must return a Node/);
  })

  it ('should not allow unescaping escaped double quotes', function () {
    // exploits:
    // 1) A bug in validateSafeMethod which allows to call any method in Object.prototype
    // 2) A bug in stringify
    assert.throws(function () {
      math.eval("x=parse(\"\\\"a\\\"\");x.__defineGetter__(\"value\",eval(\"f()=\\\"false\\\\\\\\\\\\\\\\\\\\\\\"&&eval;}};\\\/\\\/\\\"\")); x.compile().eval()(\"console.log('hacked...')\")")
    }, /Error: No access to method "__defineGetter__"/);
  })

  it ('should not allow using method chain', function () {
    assert.throws(function () {
      math.eval("chain(\"a(){return eval;};function b\").typed({\"\":f()=0}).done()()(\"console.log(\'hacked...\')\")")
    }, /is not a function/);
  })

  it ('should not allow using method chain (2)', function () {
    assert.throws(function () {
      math.eval("evilMath=chain().create().done();evilMath.import({\"_compile\":f(a,b,c)=\"eval\",\"isNode\":f()=true}); parse(\"(1)\").map(g(a,b,c)=evilMath.chain()).compile().eval()(\"console.log(\'hacked...\')\")")
    }, /is not a function/);
  })

  it ('should not allow using method Chain', function () {
    assert.throws(function () {
      math.eval("x=parse(\"a\",{nodes:{a:Chain}});Chain.bind(x,{})();evilMath=x.create().done();evilMath.import({\"_compile\":f(a,b,c)=\"eval\",\"isNode\":f()=true}); parse(\"(1)\").map(g(a,b,c)=evilMath.chain()).compile().eval()(\"console.log(\'hacked...\')\")");
    }, /Undefined symbol Chain/);
  })

  it ('should not allow passing a function name containg bad contents', function () {
    // underlying issues where:
    // the input '[]["fn"]()=0'   
    // - defines a function in the root scope, but this shouldn't be allowed syntax
    // - there is a typed function created which unsecurely evaluates JS code with the function name in it 
    //   -> when the function name contains JS code it can be executed, example:
    //
    //         var fn = typed("(){}+console.log(`hacked...`);function a", { "": function () { } })

    assert.throws(function () {
      math.eval('[]["(){}+console.log(`hacked...`);function a"]()=0')
    }, /SyntaxError: Invalid left hand side of assignment operator =/);

    assert.throws(function () {
      math.eval('{}["(){}+console.log(`hacked...`);function a"]()=0')
    }, /SyntaxError: Invalid left hand side of assignment operator =/);
  })

  it ('should allow calling functions on math', function () {
    assert.equal(math.eval('sqrt(4)'), 2);
  })

  it ('should allow invoking methods on complex numbers', function () {
    assert.deepEqual(math.eval('complex(4, 0).sqrt(2)'), math.complex(2, 0));
  })

  it ('should allow accessing properties on an object', function () {
    assert.deepEqual(math.eval('obj.a', {obj: {a:42}}), 42);
  })

  it ('should not allow accessing inherited properties on an object', function () {
    assert.throws(function () {
      math.eval('obj.constructor', {obj: {a:42}});
    }, /Error: No access to property "constructor"/)
  })

  it ('should not allow accessing __proto__', function () {
    assert.throws(function () {
      math.eval('{}.__proto__');
    }, /Error: No access to property "__proto__"/)
  })

  it ('should not allow getting properties from non plain objects', function () {
    assert.throws(function () {math.eval('[]._data')}, /No access to property "_data"/)
    assert.throws(function () {math.eval('unit("5cm").valueOf')}, /Cannot access method "valueOf" as a property/);
  });

  it ('should not have access to specific namespaces', function () {
    Object.keys(math.expression.mathWithTransform).forEach (function (name) {
      var value = math.expression.mathWithTransform[name];

      // only plain functions allowed, no constructor functions
      if (typeof value === 'function') {
        assert.strictEqual(isPlainFunction(value), true,
            'only plain functions expected, constructor functions not allowed (name: ' + name + ')');
      }
      else {
        // plain objects not allowed, only class instances like units and complex numbers
        if (value && typeof value === 'object') {
          if (isPlainObject(value) && (name !== 'uninitialized' )) {
            throw new Error('plain objects are not allowed, only class instances (object name: ' + name + ')');
          }
        }
      }

    });

    assert.throws(function () {math.eval('expression')}, /Undefined symbol/);
    assert.throws(function () {math.eval('type')}, /Undefined symbol/);
    assert.throws(function () {math.eval('error')}, /Undefined symbol/);
    assert.throws(function () {math.eval('json')}, /Undefined symbol/);

    assert.strictEqual(math.expression.mathWithTransform.Matrix, undefined);
    assert.strictEqual(math.expression.mathWithTransform.Node, undefined);
    assert.strictEqual(math.expression.mathWithTransform.chain, undefined);
    assert.deepEqual(math.eval('chain'), math.unit('chain'));
  });

});

function isPlainObject (object) {
  return typeof object === 'object' && object &&
      object.constructor === Object &&
      object.__proto__ === Object.prototype;
}

function isPlainFunction (fn) {
  return typeof fn === 'function' && fn.prototype.constructor === fn;
}
