var contexts = require('./contexts'),
    visitor = require('./visitors'),
    tree = require('./tree');

module.exports = function(root, options) {
    options = options || {};
    var evaldRoot,
        variables = options.variables,
        evalEnv = new contexts.Eval(options);

    //
    // Allows setting variables with a hash, so:
    //
    //   `{ color: new tree.Color('#f01') }` will become:
    //
    //   new tree.Declaration('@color',
    //     new tree.Value([
    //       new tree.Expression([
    //         new tree.Color('#f01')
    //       ])
    //     ])
    //   )
    //
    if (typeof variables === 'object' && !Array.isArray(variables)) {
        variables = Object.keys(variables).map(function (k) {
            var value = variables[k];

            if (!(value instanceof tree.Value)) {
                if (!(value instanceof tree.Expression)) {
                    value = new tree.Expression([value]);
                }
                value = new tree.Value([value]);
            }
            return new tree.Declaration('@' + k, value, false, null, 0);
        });
        evalEnv.frames = [new tree.Ruleset(null, variables)];
    }

    var visitors = [
            new visitor.JoinSelectorVisitor(),
            new visitor.MarkVisibleSelectorsVisitor(true),
            new visitor.ExtendVisitor(),
            new visitor.ToCSSVisitor({compress: Boolean(options.compress)})
        ], preEvalVisitors = [], v, visitorIterator;

    /**
     * first() / get() allows visitors to be added while visiting
     * 
     * @todo Add scoping for visitors just like functions for @plugin; right now they're global
     */
    if (options.pluginManager) {
        visitorIterator = options.pluginManager.visitor();
        for (var i = 0; i < 2; i++) {
            visitorIterator.first();
            while ((v = visitorIterator.get())) {
                if (v.isPreEvalVisitor) {
                    if (i === 0 || preEvalVisitors.indexOf(v) === -1) {
                        preEvalVisitors.push(v);
                        v.run(root);
                    }
                }
                else {
                    if (i === 0 || visitors.indexOf(v) === -1) {
                        if (v.isPreVisitor) {
                            visitors.unshift(v);
                        }
                        else {
                            visitors.push(v);
                        }
                    }
                }
            }
        }
    }
    
    evaldRoot = root.eval(evalEnv);

    for (var i = 0; i < visitors.length; i++) {
        visitors[i].run(evaldRoot);
    }

    // Run any remaining visitors added after eval pass
    if (options.pluginManager) {
        visitorIterator.first();
        while ((v = visitorIterator.get())) {
            if (visitors.indexOf(v) === -1 && preEvalVisitors.indexOf(v) === -1) {
                v.run(evaldRoot);
            }
        }
    }

    return evaldRoot;
};
