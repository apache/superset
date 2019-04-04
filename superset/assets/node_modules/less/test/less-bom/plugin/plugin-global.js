
functions.addMultiple({
    'test-shadow' : function() {
        return new tree.Anonymous( 'global' );
    },
    'test-global' : function() {
        return new tree.Anonymous( 'global' );
    }
});
