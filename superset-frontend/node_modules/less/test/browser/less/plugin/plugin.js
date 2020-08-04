registerPlugin({
    install: function(less, pluginManager, functions) {
        functions.add('func', function() {
            return less.anonymous(location.href);
        });
    }
});