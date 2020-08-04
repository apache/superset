const generateMatcher = require('./generate-matcher');

const sanitizeRoute = route => {
	route = Object.assign({}, route);

	if (route.method) {
		route.method = route.method.toLowerCase();
	}
	route.identifier = route.name || route.matcher;

	return route;
};

const validateRoute = route => {
	if (!('response' in route)) {
		throw new Error('fetch-mock: Each route must define a response');
	}

	if (!route.matcher) {
		throw new Error(
			'fetch-mock: Each route must specify a string, regex or function to match calls to fetch'
		);
	}
};

const limitMatcher = route => {
	if (!route.repeat) {
		return;
	}

	const matcher = route.matcher;
	let timesLeft = route.repeat;
	route.matcher = (url, options) => {
		const match = timesLeft && matcher(url, options);
		if (match) {
			timesLeft--;
			return true;
		}
	};
	route.reset = () => (timesLeft = route.repeat);
};

module.exports = route => {
	validateRoute(route);
	route = sanitizeRoute(route);
	route.matcher = generateMatcher(route);
	limitMatcher(route);
	return route;
};

module.exports.sanitizeRoute = sanitizeRoute;
