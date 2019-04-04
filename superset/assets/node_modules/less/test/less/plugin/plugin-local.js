functions.addMultiple({
    'test-shadow' : function() {
        return new tree.Anonymous( 'local' );
    },
    'test-local' : function() {
        return new tree.Anonymous( 'local' );
    }
});

registerPlugin({
    setOptions: function(opts) {
        // do nothing
    }
});
