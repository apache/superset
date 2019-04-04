var Quoted = require('../tree/quoted'),
    Anonymous = require('../tree/anonymous'),
    JavaScript = require('../tree/javascript'),
    functionRegistry = require('./function-registry');

functionRegistry.addMultiple({
    e: function (str) {
        return new Anonymous(str instanceof JavaScript ? str.evaluated : str.value);
    },
    escape: function (str) {
        return new Anonymous(
            encodeURI(str.value).replace(/=/g, '%3D').replace(/:/g, '%3A').replace(/#/g, '%23').replace(/;/g, '%3B')
                .replace(/\(/g, '%28').replace(/\)/g, '%29'));
    },
    replace: function (string, pattern, replacement, flags) {
        var result = string.value;
        replacement = (replacement.type === 'Quoted') ?
            replacement.value : replacement.toCSS();
        result = result.replace(new RegExp(pattern.value, flags ? flags.value : ''), replacement);
        return new Quoted(string.quote || '', result, string.escaped);
    },
    '%': function (string /* arg, arg, ... */) {
        var args = Array.prototype.slice.call(arguments, 1),
            result = string.value;

        for (var i = 0; i < args.length; i++) {
            /* jshint loopfunc:true */
            result = result.replace(/%[sda]/i, function(token) {
                var value = ((args[i].type === 'Quoted') &&
                    token.match(/s/i)) ? args[i].value : args[i].toCSS();
                return token.match(/[A-Z]$/) ? encodeURIComponent(value) : value;
            });
        }
        result = result.replace(/%%/g, '%');
        return new Quoted(string.quote || '', result, string.escaped);
    }
});
