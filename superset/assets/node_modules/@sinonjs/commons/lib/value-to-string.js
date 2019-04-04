"use strict";

function valueToString(value) {
    if (value && value.toString) {
        /* eslint-disable-next-line local-rules/no-prototype-methods */
        return value.toString();
    }
    return String(value);
}

module.exports = valueToString;
