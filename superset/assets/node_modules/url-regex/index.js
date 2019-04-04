'use strict';
var ipRegex = require('ip-regex');

module.exports = function (opts) {
	opts = opts || {};

	var protocol = '(?:(?:[a-z]+:)?//)';
	var auth = '(?:\\S+(?::\\S*)?@)?';
	var ip = ipRegex.v4().source;
	var host = '(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)';
	var domain = '(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*';
	var tld = '(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))';
	var port = '(?::\\d{2,5})?';
	var path = '(?:[/?#][^\\s"]*)?';
	var regex = [
		'(?:' + protocol + '|www\\.)' + auth, '(?:localhost|' + ip + '|' + host + domain + tld + ')',
		port, path
	].join('');

	return opts.exact ? new RegExp('(?:^' + regex + '$)', 'i') :
						new RegExp(regex, 'ig');
};
