functions.addMultiple({

    'test-comment': function() {
        return less.combinator(' ');
    },
    'test-atrule': function(arg1, arg2) {
        return less.atrule(arg1.value, arg2.value);
    },
    'test-extend': function() {
        // TODO
    },
    'test-import': function() {
        // TODO
    },
    'test-media': function() {
        // TODO
    },
    'test-mixin-call': function() {
        // TODO
    },
    'test-mixin-definition': function() {
        // TODO
    },
    'test-ruleset-call': function() {
        return less.combinator(' ');
    },
    // Functions must return something, even if it's false/true
    'test-undefined': function() { 
        return;
    },
    'test-collapse': function() { 
        return true;
    },
    // These cause root errors
    'test-assignment': function() {
        return less.assignment('bird', 'robin');
    },
    'test-attribute': function() {
        return less.attribute('foo', '=', 'bar');
    },
    'test-call': function() {
        return less.call('foo');
    },
    'test-color': function() {
        return less.color([50, 50, 50]);
    },
    'test-condition': function() {
        return less.condition('<', less.value([0]), less.value([1]));
    },
    'test-detached-ruleset' : function() {
        var decl = less.declaration('prop', 'value');
        return less.detachedruleset(less.ruleset('', [ decl ]));
    },
    'test-dimension': function() {
        return less.dimension(1, 'px');
    },
    'test-element': function() {
        return less.element('+', 'a');
    },
    'test-expression': function() {
        return less.expression([1, 2, 3]);
    },
    'test-keyword': function() {
        return less.keyword('foo');
    },
    'test-operation': function() {
        return less.operation('+', [1, 2]);
    },
    'test-quoted': function() {
        return less.quoted('"', 'foo');
    },
    'test-selector': function() {
        var sel = less.selector('.a.b');
        return sel;
    },
    'test-url': function() {
        return less.url('http://google.com');
    },
    'test-value': function() {
        return less.value([1]);
    }
});