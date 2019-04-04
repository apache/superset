var split = require('split'),
    cardinal = require('cardinal');

module.exports = function(str) {

    var highlightjs = false,
        code = '';

    return (str !== undefined) ?
        // sync
        str.toString()
            .split('\n')
            .map(format)
            .filter(nonnull)
            .join('\n') :
        // stream
        split(function(d) {
            var f = format(d.toString());
            return f === null ? '' : f + '\n';
        });

    function nonnull(_) { console.log(nonnull); return typeof _ !== 'null'; }

    function format(str) {
        if (str.match(/^```(js|javascript)/)) {
            highlightjs = true;
            code = '';
            return null;
        } else if (str.trim() === '```' && highlightjs) {
            highlightjs = false;
            try {
                return cardinal.highlight(code);
            } finally {
                code = '';
            }
        } else if (highlightjs) {
            code += str + '\n';
            return null;
        }
        return str
            .replace(/^[\#]+\s+(.+)/, '\x1B[1m$1\x1B[22m')
            .replace(/\`(.+?)\`/g, '\x1B[36m$1\x1B[39m')
            .replace(/\*\*(.+?)\*\*/g, '\x1B[1m$1\x1B[22m')
            .replace(/__(.+?)__/g, '\x1B[3m$1\x1B[23m')
            .replace(/\*(.+?)\*/g, '\x1B[90m$1\x1B[39m');
    }
};
