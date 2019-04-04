var Selector = require('./selector'),
    Element = require('./element'),
    Ruleset = require('./ruleset'),
    Declaration = require('./declaration'),
    DetachedRuleset = require('./detached-ruleset'),
    Expression = require('./expression'),
    contexts = require('../contexts'),
    utils = require('../utils');

var Definition = function (name, params, rules, condition, variadic, frames, visibilityInfo) {
    this.name = name || 'anonymous mixin';
    this.selectors = [new Selector([new Element(null, name, false, this._index, this._fileInfo)])];
    this.params = params;
    this.condition = condition;
    this.variadic = variadic;
    this.arity = params.length;
    this.rules = rules;
    this._lookups = {};
    var optionalParameters = [];
    this.required = params.reduce(function (count, p) {
        if (!p.name || (p.name && !p.value)) {
            return count + 1;
        }
        else {
            optionalParameters.push(p.name);
            return count;
        }
    }, 0);
    this.optionalParameters = optionalParameters;
    this.frames = frames;
    this.copyVisibilityInfo(visibilityInfo);
    this.allowRoot = true;
};
Definition.prototype = new Ruleset();
Definition.prototype.type = 'MixinDefinition';
Definition.prototype.evalFirst = true;
Definition.prototype.accept = function (visitor) {
    if (this.params && this.params.length) {
        this.params = visitor.visitArray(this.params);
    }
    this.rules = visitor.visitArray(this.rules);
    if (this.condition) {
        this.condition = visitor.visit(this.condition);
    }
};
Definition.prototype.evalParams = function (context, mixinEnv, args, evaldArguments) {
    /* jshint boss:true */
    var frame = new Ruleset(null, null),
        varargs, arg,
        params = utils.copyArray(this.params),
        i, j, val, name, isNamedFound, argIndex, argsLength = 0;

    if (mixinEnv.frames && mixinEnv.frames[0] && mixinEnv.frames[0].functionRegistry) {
        frame.functionRegistry = mixinEnv.frames[0].functionRegistry.inherit();
    }
    mixinEnv = new contexts.Eval(mixinEnv, [frame].concat(mixinEnv.frames));

    if (args) {
        args = utils.copyArray(args);
        argsLength = args.length;

        for (i = 0; i < argsLength; i++) {
            arg = args[i];
            if (name = (arg && arg.name)) {
                isNamedFound = false;
                for (j = 0; j < params.length; j++) {
                    if (!evaldArguments[j] && name === params[j].name) {
                        evaldArguments[j] = arg.value.eval(context);
                        frame.prependRule(new Declaration(name, arg.value.eval(context)));
                        isNamedFound = true;
                        break;
                    }
                }
                if (isNamedFound) {
                    args.splice(i, 1);
                    i--;
                    continue;
                } else {
                    throw { type: 'Runtime', message: 'Named argument for ' + this.name +
                        ' ' + args[i].name + ' not found' };
                }
            }
        }
    }
    argIndex = 0;
    for (i = 0; i < params.length; i++) {
        if (evaldArguments[i]) { continue; }

        arg = args && args[argIndex];

        if (name = params[i].name) {
            if (params[i].variadic) {
                varargs = [];
                for (j = argIndex; j < argsLength; j++) {
                    varargs.push(args[j].value.eval(context));
                }
                frame.prependRule(new Declaration(name, new Expression(varargs).eval(context)));
            } else {
                val = arg && arg.value;
                if (val) {
                    // This was a mixin call, pass in a detached ruleset of it's eval'd rules
                    if (Array.isArray(val)) {
                        val = new DetachedRuleset(new Ruleset('', val));
                    }
                    else {
                        val = val.eval(context);
                    }
                } else if (params[i].value) {
                    val = params[i].value.eval(mixinEnv);
                    frame.resetCache();
                } else {
                    throw { type: 'Runtime', message: 'wrong number of arguments for ' + this.name +
                        ' (' + argsLength + ' for ' + this.arity + ')' };
                }

                frame.prependRule(new Declaration(name, val));
                evaldArguments[i] = val;
            }
        }

        if (params[i].variadic && args) {
            for (j = argIndex; j < argsLength; j++) {
                evaldArguments[j] = args[j].value.eval(context);
            }
        }
        argIndex++;
    }

    return frame;
};
Definition.prototype.makeImportant = function() {
    var rules = !this.rules ? this.rules : this.rules.map(function (r) {
        if (r.makeImportant) {
            return r.makeImportant(true);
        } else {
            return r;
        }
    });
    var result = new Definition(this.name, this.params, rules, this.condition, this.variadic, this.frames);
    return result;
};
Definition.prototype.eval = function (context) {
    return new Definition(this.name, this.params, this.rules, this.condition, this.variadic, this.frames || utils.copyArray(context.frames));
};
Definition.prototype.evalCall = function (context, args, important) {
    var _arguments = [],
        mixinFrames = this.frames ? this.frames.concat(context.frames) : context.frames,
        frame = this.evalParams(context, new contexts.Eval(context, mixinFrames), args, _arguments),
        rules, ruleset;

    frame.prependRule(new Declaration('@arguments', new Expression(_arguments).eval(context)));

    rules = utils.copyArray(this.rules);

    ruleset = new Ruleset(null, rules);
    ruleset.originalRuleset = this;
    ruleset = ruleset.eval(new contexts.Eval(context, [this, frame].concat(mixinFrames)));
    if (important) {
        ruleset = ruleset.makeImportant();
    }
    return ruleset;
};
Definition.prototype.matchCondition = function (args, context) {
    if (this.condition && !this.condition.eval(
        new contexts.Eval(context,
            [this.evalParams(context, /* the parameter variables */
                new contexts.Eval(context, this.frames ? this.frames.concat(context.frames) : context.frames), args, [])]
            .concat(this.frames || []) // the parent namespace/mixin frames
            .concat(context.frames)))) { // the current environment frames
        return false;
    }
    return true;
};
Definition.prototype.matchArgs = function (args, context) {
    var allArgsCnt = (args && args.length) || 0, len, optionalParameters = this.optionalParameters;
    var requiredArgsCnt = !args ? 0 : args.reduce(function (count, p) {
        if (optionalParameters.indexOf(p.name) < 0) {
            return count + 1;
        } else {
            return count;
        }
    }, 0);

    if (!this.variadic) {
        if (requiredArgsCnt < this.required) {
            return false;
        }
        if (allArgsCnt > this.params.length) {
            return false;
        }
    } else {
        if (requiredArgsCnt < (this.required - 1)) {
            return false;
        }
    }

    // check patterns
    len = Math.min(requiredArgsCnt, this.arity);

    for (var i = 0; i < len; i++) {
        if (!this.params[i].name && !this.params[i].variadic) {
            if (args[i].value.eval(context).toCSS() != this.params[i].value.eval(context).toCSS()) {
                return false;
            }
        }
    }
    return true;
};
module.exports = Definition;
