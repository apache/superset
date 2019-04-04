'use strict';
var styles = module.exports;

var codes = {
	reset: [0, 0],

	bold: [1, 22],
	italic: [3, 23],
	underline: [4, 24],
	inverse: [7, 27],
	strikethrough: [9, 29],

	black: [30, 39],
	red: [31, 39],
	green: [32, 39],
	yellow: [33, 39],
	blue: [34, 39],
	magenta: [35, 39],
	cyan: [36, 39],
	white: [37, 39],
	gray: [90, 39],

	bgBlack: [40, 49],
	bgRed: [41, 49],
	bgGreen: [42, 49],
	bgYellow: [43, 49],
	bgBlue: [44, 49],
	bgMagenta: [45, 49],
	bgCyan: [46, 49],
	bgWhite: [47, 49]
};

Object.keys(codes).forEach(function (key) {
	var val = codes[key];
	var style = styles[key] = {};
	style.open = '\x1b[' + val[0] + 'm';
	style.close = '\x1b[' + val[1] + 'm';
});
