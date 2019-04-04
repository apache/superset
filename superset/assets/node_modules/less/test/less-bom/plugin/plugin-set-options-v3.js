var optionsStack = [
    'option1',
    undefined,
    'option2',
    undefined,
    'option3'
];

var options, error;

registerPlugin({
    install: function(less, pluginManager, functions) {
        if (options) {
            error = 'setOptions() called before install';
        }
    },
    use: function() {
        var pos = optionsStack.indexOf(options);

        if (pos === -1) {
            error = 'setOptions() not setting option "' + opt + '" correctly';
        }
        if (error) {
            throw new Error(error);
        }
    },
    setOptions: function(opts) {
        options = opts;
    },
    minVersion: [3,0,0]
});
