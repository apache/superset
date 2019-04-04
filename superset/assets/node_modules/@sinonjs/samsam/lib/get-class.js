"use strict";

var o = Object.prototype;

function getClass(value) {
    // Returns the internal [[Class]] by calling Object.prototype.toString
    // with the provided value as this. Return value is a string, naming the
    // internal class, e.g. "Array"
    return o.toString.call(value).split(/[ \]]/)[1];
}

module.exports = getClass;
