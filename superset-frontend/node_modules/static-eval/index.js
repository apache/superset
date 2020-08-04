var unparse = require('escodegen').generate;

module.exports = function (ast, vars, opts) {
    if(!opts) opts = {};
    var rejectAccessToMethodsOnFunctions = !opts.allowAccessToMethodsOnFunctions;

    if (!vars) vars = {};
    var FAIL = {};

    var result = (function walk (node, noExecute) {
        if (node.type === 'Literal') {
            return node.value;
        }
        else if (node.type === 'UnaryExpression'){
            var val = walk(node.argument, noExecute)
            if (node.operator === '+') return +val
            if (node.operator === '-') return -val
            if (node.operator === '~') return ~val
            if (node.operator === '!') return !val
            return FAIL
        }
        else if (node.type === 'ArrayExpression') {
            var xs = [];
            for (var i = 0, l = node.elements.length; i < l; i++) {
                var x = walk(node.elements[i], noExecute);
                if (x === FAIL) return FAIL;
                xs.push(x);
            }
            return xs;
        }
        else if (node.type === 'ObjectExpression') {
            var obj = {};
            for (var i = 0; i < node.properties.length; i++) {
                var prop = node.properties[i];
                var value = prop.value === null
                    ? prop.value
                    : walk(prop.value, noExecute)
                ;
                if (value === FAIL) return FAIL;
                obj[prop.key.value || prop.key.name] = value;
            }
            return obj;
        }
        else if (node.type === 'BinaryExpression' ||
                 node.type === 'LogicalExpression') {
            var op = node.operator;

            if (op === '&&') {
                var l = walk(node.left);
                if (l === FAIL) return FAIL;
                if (!l) return l;
                var r = walk(node.right);
                if (r === FAIL) return FAIL;
                return r;
            }
            else if (op === '||') {
                var l = walk(node.left);
                if (l === FAIL) return FAIL;
                if (l) return l;
                var r = walk(node.right);
                if (r === FAIL) return FAIL;
                return r;
            }

            var l = walk(node.left, noExecute);
            if (l === FAIL) return FAIL;
            var r = walk(node.right, noExecute);
            if (r === FAIL) return FAIL;

            if (op === '==') return l == r;
            if (op === '===') return l === r;
            if (op === '!=') return l != r;
            if (op === '!==') return l !== r;
            if (op === '+') return l + r;
            if (op === '-') return l - r;
            if (op === '*') return l * r;
            if (op === '/') return l / r;
            if (op === '%') return l % r;
            if (op === '<') return l < r;
            if (op === '<=') return l <= r;
            if (op === '>') return l > r;
            if (op === '>=') return l >= r;
            if (op === '|') return l | r;
            if (op === '&') return l & r;
            if (op === '^') return l ^ r;

            return FAIL;
        }
        else if (node.type === 'Identifier') {
            if ({}.hasOwnProperty.call(vars, node.name)) {
                return vars[node.name];
            }
            else return FAIL;
        }
        else if (node.type === 'ThisExpression') {
            if ({}.hasOwnProperty.call(vars, 'this')) {
                return vars['this'];
            }
            else return FAIL;
        }
        else if (node.type === 'CallExpression') {
            var callee = walk(node.callee, noExecute);
            if (callee === FAIL) return FAIL;
            if (typeof callee !== 'function') return FAIL;


            var ctx = node.callee.object ? walk(node.callee.object, noExecute) : FAIL;
            if (ctx === FAIL) ctx = null;

            var args = [];
            for (var i = 0, l = node.arguments.length; i < l; i++) {
                var x = walk(node.arguments[i], noExecute);
                if (x === FAIL) return FAIL;
                args.push(x);
            }

            if (noExecute) {
                return undefined;
            }

            return callee.apply(ctx, args);
        }
        else if (node.type === 'MemberExpression') {
            var obj = walk(node.object, noExecute);
            if((obj === FAIL) || (
                (typeof obj == 'function') && rejectAccessToMethodsOnFunctions
            )){
                return FAIL;
            }
            if (node.property.type === 'Identifier' && !node.computed) {
                if (isUnsafeProperty(node.property.name)) return FAIL;
                return obj[node.property.name];
            }
            var prop = walk(node.property, noExecute);
            if (prop === null || prop === FAIL) return FAIL;
            if (isUnsafeProperty(prop)) return FAIL;
            return obj[prop];
        }
        else if (node.type === 'ConditionalExpression') {
            var val = walk(node.test, noExecute)
            if (val === FAIL) return FAIL;
            return val ? walk(node.consequent) : walk(node.alternate, noExecute)
        }
        else if (node.type === 'ExpressionStatement') {
            var val = walk(node.expression, noExecute)
            if (val === FAIL) return FAIL;
            return val;
        }
        else if (node.type === 'ReturnStatement') {
            return walk(node.argument, noExecute)
        }
        else if (node.type === 'FunctionExpression') {
            var bodies = node.body.body;

            // Create a "scope" for our arguments
            var oldVars = {};
            Object.keys(vars).forEach(function(element){
                oldVars[element] = vars[element];
            })

            for(var i=0; i<node.params.length; i++){
                var key = node.params[i];
                if(key.type == 'Identifier'){
                  vars[key.name] = null;
                }
                else return FAIL;
            }
            for(var i in bodies){
                if(walk(bodies[i], true) === FAIL){
                    return FAIL;
                }
            }
            // restore the vars and scope after we walk
            vars = oldVars;

            var keys = Object.keys(vars);
            var vals = keys.map(function(key) {
                return vars[key];
            });
            return Function(keys.join(', '), 'return ' + unparse(node)).apply(null, vals);
        }
        else if (node.type === 'TemplateLiteral') {
            var str = '';
            for (var i = 0; i < node.expressions.length; i++) {
                str += walk(node.quasis[i], noExecute);
                str += walk(node.expressions[i], noExecute);
            }
            str += walk(node.quasis[i], noExecute);
            return str;
        }
        else if (node.type === 'TaggedTemplateExpression') {
            var tag = walk(node.tag, noExecute);
            var quasi = node.quasi;
            var strings = quasi.quasis.map(walk);
            var values = quasi.expressions.map(walk);
            return tag.apply(null, [strings].concat(values));
        }
        else if (node.type === 'TemplateElement') {
            return node.value.cooked;
        }
        else return FAIL;
    })(ast);

    return result === FAIL ? undefined : result;
};

function isUnsafeProperty(name) {
    return name === 'constructor' || name === '__proto__';
}
