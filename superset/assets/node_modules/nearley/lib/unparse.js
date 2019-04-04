(function(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('./nearley'));
    } else {
        root.Unparser = factory(root.nearley);
    }
}(this, function(nearley) {

    var randexp = require('randexp');

    function genRandom(grammar, start) {
        // The first-generation generator. It just spews out stuff randomly, and is
        // not at all guaranteed to terminate. However, it is extremely performant.

        var output = "";

        var stack = [start];

        while (stack.length > 0) {
            var currentname = stack.pop();
            if (typeof(currentname) === 'string') {
                var goodrules = grammar.rules.filter(function(x) {
                    return x.name === currentname;
                });
                if (goodrules.length > 0) {
                    var chosen = goodrules[
                        Math.floor(Math.random()*goodrules.length)
                    ];
                    for (var i=chosen.symbols.length-1; i>=0; i--) {
                        stack.push(chosen.symbols[i]);
                    }
                } else {
                    throw new Error("Nothing matches rule: "+currentname+"!");
                }
            } else if (currentname.test) {
                var c = new randexp(currentname).gen();
                output += c;
                continue;
            } else if (currentname.literal) {
                output += currentname.literal;
                continue;
            }
        }

        return output;
    }

    function genBounded(grammar, start, depth) {
        // I guess you could call this the second-generation generator.
        // All it does is bound its output by a certain depth without having to
        // backtrack. It doesn't give guarantees on being uniformly random, but
        // that's doable if we *really* need it (by converting min_depth_rule, a
        // predicate, into something that counts the number of trees of depth d).

        var rules = grammar.rules;
        var min_depths_rule = [];

        function synth_nt(name, depth) {
            var good_rules = [];
            var min_min_depth = Infinity;
            for (var i=0; i<rules.length; i++) {
                min_depths_rule = [];
                var size = min_depth_rule(i, []);
                if (rules[i].name === name) {
                    min_min_depth = Math.min(min_min_depth, size);
                    if (size < depth) {
                        good_rules.push(i);
                    }
                }
            }
            if (good_rules.length === 0) {
                throw ("No strings in your grammar have depth "+depth+" (and " +
                       "none are shallower). Try increasing -d to at least "+
                       (min_min_depth+1) + ".");
            }

            var r = good_rules[Math.floor(Math.random()*good_rules.length)];
            return synth_rule(r, depth);
        }
        function synth_rule(idx, depth) {
            var ret = "";
            for (var i=0; i<rules[idx].symbols.length; i++) {
                var tok = rules[idx].symbols[i];
                if (typeof(tok) === 'string') {
                    ret += synth_nt(tok, depth-1);
                } else if (tok.test) {
                    ret += new randexp(tok).gen();
                } else if (tok.literal) {
                    ret += tok.literal;
                }
            }
            return ret;
        }
        function min_depth_nt(name, visited) {
            if (visited.indexOf(name) !== -1) {
                return +Infinity;
            }
            var d = +Infinity;
            for (var i=0; i<rules.length; i++) {
                if (rules[i].name === name) {
                    d = Math.min(d, min_depth_rule(i, [name].concat(visited)));
                }
            }
            return d;
        }
        function min_depth_rule(idx, visited) {
            if (min_depths_rule[idx] !== undefined) return min_depths_rule[idx];

            var d = 1;
            for (var i=0; i<rules[idx].symbols.length; i++) {
                var tok = rules[idx].symbols[i];
                if (typeof(tok) === 'string') {
                    d = Math.max(d, 1+min_depth_nt(tok, visited));
                }
            }
            min_depths_rule[idx] = d;
            return d;
        }

        var ret = synth_nt(start, depth);
        return ret;
    }

    function Unparse(rules, start, depth) {
        if (rules instanceof nearley.Grammar) {
            var grammar = rules;
        } else {
            var grammar = nearley.Grammar.fromCompiled(rules, start);
        }
        if (depth != null && depth > 0) {
            return genBounded(grammar, start, depth);
        } else {
            return genRandom(grammar, start);
        }
    }

    return Unparse;

}));
