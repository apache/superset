"use strict";

var supportsColor = require("supports-color");

function colorize(str, color) {
    if (supportsColor.stdout === false) {
        return str;
    }

    return "\x1b[" + color + "m" + str + "\x1b[0m";
}

exports.red = function (str) {
    return colorize(str, 31);
};

exports.green = function (str) {
    return colorize(str, 32);
};

exports.cyan = function (str) {
    return colorize(str, 96);
};

exports.white = function (str) {
    return colorize(str, 39);
};

exports.bold = function (str) {
    return colorize(str, 1);
};
