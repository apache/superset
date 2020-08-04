(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./nearley'));
    } else {
        root.Compile = factory(root.nearley);
    }
}(this, function(nearley) {

    function Compile(structure, opts) {
        var unique = uniquer();
        if (!opts.alreadycompiled) {
            opts.alreadycompiled = [];
        }

        var result = {
            rules: [],
            body: [], // @directives list
            customTokens: [], // %tokens
            config: {}, // @config value
            macros: {},
            start: '',
            version: opts.version || 'unknown'
        };

        for (var i = 0; i < structure.length; i++) {
            var productionRule = structure[i];
            if (productionRule.body) {
                // This isn't a rule, it's an @directive.
                if (!opts.nojs) {
                    result.body.push(productionRule.body);
                }
            } else if (productionRule.include) {
                // Include file
                var path;
                if (!productionRule.builtin) {
                    path = require('path').resolve(
                        opts.args[0] ? require('path').dirname(opts.args[0]) : process.cwd(),
                        productionRule.include
                    );
                } else {
                    path = require('path').resolve(
                        __dirname,
                        '../builtin/',
                        productionRule.include
                    );
                }
                if (opts.alreadycompiled.indexOf(path) === -1) {
                    opts.alreadycompiled.push(path);
                    var f = require('fs').readFileSync(path).toString();
                    var parserGrammar = nearley.Grammar.fromCompiled(require('./nearley-language-bootstrapped.js'));
                    var parser = new nearley.Parser(parserGrammar);
                    parser.feed(f);
                    var c = Compile(parser.results[0], {args: [path], __proto__:opts});
                    result.rules = result.rules.concat(c.rules);
                    result.body  = result.body.concat(c.body);
                    result.customTokens = result.customTokens.concat(c.customTokens);
                    Object.keys(c.config).forEach(function(k) {
                        result.config[k] = c.config[k];
                    });
                    Object.keys(c.macros).forEach(function(k) {
                        result.macros[k] = c.macros[k];
                    });
                }
            } else if (productionRule.macro) {
                result.macros[productionRule.macro] = {
                    'args': productionRule.args,
                    'exprs': productionRule.exprs
                };
            } else if (productionRule.config) {
                // This isn't a rule, it's an @config.
                result.config[productionRule.config] = productionRule.value
            } else {
                produceRules(productionRule.name, productionRule.rules, {});
                if (!result.start) {
                    result.start = productionRule.name;
                }
            }
        }

        return result;

        function produceRules(name, rules, env) {
            for (var i = 0; i < rules.length; i++) {
                var rule = buildRule(name, rules[i], env);
                if (opts.nojs) {
                    rule.postprocess = null;
                }
                result.rules.push(rule);
            }
        }

        function buildRule(ruleName, rule, env) {
            var tokens = [];
            for (var i = 0; i < rule.tokens.length; i++) {
                var token = buildToken(ruleName, rule.tokens[i], env);
                if (token !== null) {
                    tokens.push(token);
                }
            }
            return new nearley.Rule(
                ruleName,
                tokens,
                rule.postprocess
            );
        }

        function buildToken(ruleName, token, env) {
            if (typeof token === 'string') {
                if (token === 'null') {
                    return null;
                }
                return token;
            }

            if (token instanceof RegExp) {
                return token;
            }

            if (token.literal) {
                if (!token.literal.length) {
                    return null;
                }
                if (token.literal.length === 1 || result.config.lexer) {
                    return token;
                }
                return buildStringToken(ruleName, token, env);
            }
            if (token.token) {
                if (result.config.lexer) {
                    var name = token.token;
                    if (result.customTokens.indexOf(name) === -1) {
                        result.customTokens.push(name);
                    }
                    var expr = result.config.lexer + ".has(" + JSON.stringify(name) + ") ? {type: " + JSON.stringify(name) + "} : " + name;
                    return {token: "(" + expr + ")"};
                }
                return token;
            }

            if (token.subexpression) {
                return buildSubExpressionToken(ruleName, token, env);
            }

            if (token.ebnf) {
                return buildEBNFToken(ruleName, token, env);
            }

            if (token.macrocall) {
                return buildMacroCallToken(ruleName, token, env);
            }

            if (token.mixin) {
                if (env[token.mixin]) {
                    return buildToken(ruleName, env[token.mixin], env);
                } else {
                    throw new Error("Unbound variable: " + token.mixin);
                }
            }

            throw new Error("unrecognized token: " + JSON.stringify(token));
        }

        function buildStringToken(ruleName, token, env) {
            var newname = unique(ruleName + "$string");
            produceRules(newname, [
                {
                    tokens: token.literal.split("").map(function charLiteral(d) {
                        return {
                            literal: d
                        };
                    }),
                    postprocess: {builtin: "joiner"}
                }
            ], env);
            return newname;
        }

        function buildSubExpressionToken(ruleName, token, env) {
            var data = token.subexpression;
            var name = unique(ruleName + "$subexpression");
            //structure.push({"name": name, "rules": data});
            produceRules(name, data, env);
            return name;
        }

        function buildEBNFToken(ruleName, token, env) {
            switch (token.modifier) {
                case ":+":
                    return buildEBNFPlus(ruleName, token, env);
                case ":*":
                    return buildEBNFStar(ruleName, token, env);
                case ":?":
                    return buildEBNFOpt(ruleName, token, env);
            }
        }

        function buildEBNFPlus(ruleName, token, env) {
            var name = unique(ruleName + "$ebnf");
            /*
            structure.push({
                name: name,
                rules: [{
                    tokens: [token.ebnf],
                }, {
                    tokens: [token.ebnf, name],
                    postprocess: {builtin: "arrconcat"}
                }]
            });
            */
            produceRules(name,
                [{
                    tokens: [token.ebnf],
                }, {
                    tokens: [name, token.ebnf],
                    postprocess: {builtin: "arrpush"}
                }],
                env
            );
            return name;
        }

        function buildEBNFStar(ruleName, token, env) {
            var name = unique(ruleName + "$ebnf");
            /*
            structure.push({
                name: name,
                rules: [{
                    tokens: [],
                }, {
                    tokens: [token.ebnf, name],
                    postprocess: {builtin: "arrconcat"}
                }]
            });
            */
            produceRules(name,
                [{
                    tokens: [],
                }, {
                    tokens: [name, token.ebnf],
                    postprocess: {builtin: "arrpush"}
                }],
                env
            );
            return name;
        }

        function buildEBNFOpt(ruleName, token, env) {
            var name = unique(ruleName + "$ebnf");
            /*
            structure.push({
                name: name,
                rules: [{
                    tokens: [token.ebnf],
                    postprocess: {builtin: "id"}
                }, {
                    tokens: [],
                    postprocess: {builtin: "nuller"}
                }]
            });
            */
            produceRules(name,
                [{
                    tokens: [token.ebnf],
                    postprocess: {builtin: "id"}
                }, {
                    tokens: [],
                    postprocess: {builtin: "nuller"}
                }],
                env
            );
            return name;
        }

        function buildMacroCallToken(ruleName, token, env) {
            var name = unique(ruleName + "$macrocall");
            var macro = result.macros[token.macrocall];
            if (!macro) {
                throw new Error("Unkown macro: "+token.macrocall);
            }
            if (macro.args.length !== token.args.length) {
                throw new Error("Argument count mismatch.");
            }
            var newenv = {__proto__: env};
            for (var i=0; i<macro.args.length; i++) {
                var argrulename = unique(ruleName + "$macrocall");
                newenv[macro.args[i]] = argrulename;
                produceRules(argrulename, [token.args[i]], env);
                //structure.push({"name": argrulename, "rules":[token.args[i]]});
                //buildRule(name, token.args[i], env);
            }
            produceRules(name, macro.exprs, newenv);
            return name;
        }
    }

    function uniquer() {
        var uns = {};
        return unique;
        function unique(name) {
            var un = uns[name] = (uns[name] || 0) + 1;
            return name + '$' + un;
        }
    }

    return Compile;

}));
