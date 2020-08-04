var optionsStack = [
    'option1',
    undefined,
    'option2',
    undefined,
    'option3'
];

var optionsWereSet = false;
var options, error;

registerPlugin({
    install: function(less, pluginManager, functions) {
        if (!optionsWereSet) {
            error = 'setOptions() not called before install';
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
        optionsWereSet = true;
        options = opts;
    },
    minVersion: [2,0,0]
});
