'use strict';

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var generateMatcher = require('./generate-matcher');

var sanitizeRoute = function sanitizeRoute(route) {
	route = (0, _assign2.default)({}, route);

	if (route.method) {
		route.method = route.method.toLowerCase();
	}
	route.identifier = route.name || route.matcher;

	return route;
};

var validateRoute = function validateRoute(route) {
	if (!('response' in route)) {
		throw new Error('fetch-mock: Each route must define a response');
	}

	if (!route.matcher) {
		throw new Error('fetch-mock: Each route must specify a string, regex or function to match calls to fetch');
	}
};

var limitMatcher = function limitMatcher(route) {
	if (!route.repeat) {
		return;
	}

	var matcher = route.matcher;
	var timesLeft = route.repeat;
	route.matcher = function (url, options) {
		var match = timesLeft && matcher(url, options);
		if (match) {
			timesLeft--;
			return true;
		}
	};
	route.reset = function () {
		return timesLeft = route.repeat;
	};
};

module.exports = function (route) {
	validateRoute(route);
	route = sanitizeRoute(route);
	route.matcher = generateMatcher(route);
	limitMatcher(route);
	return route;
};

module.exports.sanitizeRoute = sanitizeRoute;