var REVERSE_SOLIDUS = 0x5c; // \
var QUOTATION_MARK = 0x22;  // "
var APOSTROPHE = 0x27;      // '
var TAB = 0x09;             // tab
var WHITESPACE = 0x20;      // space
var AMPERSAND = 0x26;
var LESSTHANSIGN = 0x3C;
var GREATERTHANSIGN = 0x3E;

function isHex(code) {
    return (code >= 48 && code <= 57) || // 0 .. 9
           (code >= 65 && code <= 70) || // A .. F
           (code >= 97 && code <= 102);  // a .. f
}

function decodeString(str) {
    var decoded = '';
    var len = str.length;
    var firstChar = str.charCodeAt(0);
    var start = firstChar === QUOTATION_MARK || firstChar === APOSTROPHE ? 1 : 0;
    var end = start === 1 && len > 1 && str.charCodeAt(len - 1) === firstChar ? len - 2 : len - 1;

    for (var i = start; i <= end; i++) {
        var code = str.charCodeAt(i);

        if (code === REVERSE_SOLIDUS) {
            // special case at the ending
            if (i === end) {
                // if the next input code point is EOF, do nothing
                // otherwise include last quote as escaped
                if (i !== len - 1) {
                    decoded = str.substr(i + 1);
                }
                break;
            }

            code = str.charCodeAt(++i);

            // ignore escaped newline
            if (code !== 0x0A && code !== 0x0C && code !== 0x0D) { // TODO: should treat a "CR/LF" pair (U+000D/U+000A) as a single white space character
                // https://drafts.csswg.org/css-syntax/#consume-escaped-code-point
                for (var j = 0; j < 6 && i + j <= end;) {
                    code = str.charCodeAt(i + j);

                    if (isHex(code)) {
                        j++;
                    } else {
                        break;
                    }
                }

                if (j > 0) {
                    code = str.charCodeAt(i + j);

                    // include space into sequence
                    // TODO: add newline support
                    if (code === WHITESPACE || code === TAB) {
                        j++;
                    }

                    code = parseInt(str.substr(i, j), 16);

                    if (
                        (code === 0) ||                       // If this number is zero,
                        (code >= 0xD800 && code <= 0xDFFF) || // or is for a surrogate,
                        (code > 0x10FFFF)                     // or is greater than the maximum allowed code point
                       ) {
                        // ... return U+FFFD REPLACEMENT CHARACTER
                        code = 0xFFFD;
                    }

                    // FIXME: code above 0xFFFF will be converted incorrectly,
                    // better to use String.fromCharPoint() but it lack of support by engines
                    decoded += String.fromCharCode(code);
                    i += j - 1;
                } else {
                    decoded += str.charAt(i);
                }
            }
        } else {
            decoded += str.charAt(i);
        }
    }

    return decoded;
}

function encodeString(str, apostrophe) {
    var quote = apostrophe ? '\'' : '"';
    var quoteCode = apostrophe ? APOSTROPHE : QUOTATION_MARK;
    var encoded = quote;
    var wsBeforeHexIsNeeded = false;

    for (var i = 0; i < str.length; i++) {
        var code = str.charCodeAt(i);

        if (code <= 0x1F || code === AMPERSAND || code === LESSTHANSIGN || code === GREATERTHANSIGN) {
            encoded += '\\' + code.toString(16);
            wsBeforeHexIsNeeded = true;
        } else if (code === REVERSE_SOLIDUS || code === quoteCode) {
            encoded += '\\' + str.charAt(i);
            wsBeforeHexIsNeeded = false;
        } else {
            if (wsBeforeHexIsNeeded && isHex(code)) {
                encoded += ' ';
            }

            encoded += str.charAt(i);
            wsBeforeHexIsNeeded = false;
        }
    }

    encoded += quote;

    return encoded;
}

module.exports = {
    decode: decodeString,
    encode: encodeString
};
