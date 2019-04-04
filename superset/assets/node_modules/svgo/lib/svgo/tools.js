'use strict';

/**
 * Encode plain SVG data string into Data URI string.
 *
 * @param {String} str input string
 * @param {String} type Data URI type
 * @return {String} output string
 */
exports.encodeSVGDatauri = function(str, type) {

    var prefix = 'data:image/svg+xml';

    // base64
    if (!type || type === 'base64') {

        prefix += ';base64,';
        if (Buffer.from) {
            str = prefix + Buffer.from(str).toString('base64');
        } else {
            str = prefix + new Buffer(str).toString('base64');
        }
        
    // URI encoded
    } else if (type === 'enc') {

        str = prefix + ',' + encodeURIComponent(str);

    // unencoded
    } else if (type === 'unenc') {

        str = prefix + ',' + str;

    }

    return str;

};

/**
 * Decode SVG Data URI string into plain SVG string.
 *
 * @param {string} str input string
 * @return {String} output string
 */
exports.decodeSVGDatauri = function(str) {
    var regexp = /data:image\/svg\+xml(;charset=[^;,]*)?(;base64)?,(.*)/;
    var match = regexp.exec(str);

    // plain string
    if (!match) return str;

    var data = match[3];

    // base64
    if (match[2]) {

        str = new Buffer(data, 'base64').toString('utf8');

    // URI encoded
    } else if (data.charAt(0) === '%') {

        str = decodeURIComponent(data);

    // unencoded
    } else if (data.charAt(0) === '<') {

        str = data;

    }

    return str;
};

exports.intersectArrays = function(a, b) {
    return a.filter(function(n) {
        return b.indexOf(n) > -1;
    });
};

exports.cleanupOutData = function(data, params) {

    var str = '',
        delimiter,
        prev;

    data.forEach(function(item, i) {

        // space delimiter by default
        delimiter = ' ';

        // no extra space in front of first number
        if (i === 0) {
            delimiter = '';
        }

        // remove floating-point numbers leading zeros
        // 0.5 → .5
        // -0.5 → -.5
        if (params.leadingZero) {
            item = removeLeadingZero(item);
        }

        // no extra space in front of negative number or
        // in front of a floating number if a previous number is floating too
        if (
            params.negativeExtraSpace &&
            (item < 0 ||
                (String(item).charCodeAt(0) == 46 && prev % 1 !== 0)
            )
        ) {
            delimiter = '';
        }

        // save prev item value
        prev = item;

        str += delimiter + item;

    });

    return str;

};

/**
 * Remove floating-point numbers leading zero.
 *
 * @example
 * 0.5 → .5
 *
 * @example
 * -0.5 → -.5
 *
 * @param {Float} num input number
 *
 * @return {String} output number as string
 */
var removeLeadingZero = exports.removeLeadingZero = function(num) {
    var strNum = num.toString();

    if (0 < num && num < 1 && strNum.charCodeAt(0) == 48) {
        strNum = strNum.slice(1);
    } else if (-1 < num && num < 0 && strNum.charCodeAt(1) == 48) {
        strNum = strNum.charAt(0) + strNum.slice(2);
    }

    return strNum;

};
