/*
	MIT License http://www.opensource.org/licenses/mit-license.php
	Author Tobias Koppers @sokra
*/
function UnsafeCachePlugin(regExps, cache) {
	this.regExps = regExps || [/./];
	if(this.regExps === true) this.regExps = [/./];
	else if(!Array.isArray(this.regExps)) this.regExps = [this.regExps];
	this.cache = cache || {};
}
module.exports = UnsafeCachePlugin;

UnsafeCachePlugin.prototype.apply = function(resolver) {
	var oldResolve = resolver.resolve;
	var regExps = this.regExps;
	var cache = this.cache;
	resolver.resolve = function resolve(context, request, callback) {
		var id = context + "->" + request;
		if(cache[id]) {
			// From cache
			return callback(null, cache[id]);
		}
		oldResolve.call(resolver, context, request, function(err, result) {
			if(err) return callback(err);
			var doCache = regExps.some(function(regExp) {
				return regExp.test(result.path);
			});
			if(!doCache) return callback(null, result);
			callback(null, cache[id] = result);
		});
	};
};
