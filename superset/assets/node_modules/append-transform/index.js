'use strict';
const js = require('default-require-extensions/js');

module.exports = appendTransform;

let count = 0;

function appendTransform(transform, ext, extensions) {
	// Generate a unique key for this transform
	var key = __dirname + count; // eslint-disable-line
	count++;
	ext = ext || '.js';
	extensions = extensions || require.extensions;

	let forwardGet;
	let forwardSet;

	const descriptor = Object.getOwnPropertyDescriptor(extensions, ext) || {value: js, configurable: true};

	if (
		((descriptor.get || descriptor.set) && !(descriptor.get && descriptor.set)) ||
		!descriptor.configurable
	) {
		throw new Error('Somebody did bad things to require.extensions["' + ext + '"]');
	}

	if (descriptor.get) {
		// Wrap a previous append-transform install and pass through to the getter/setter pair it created
		forwardGet = function () {
			return descriptor.get();
		};
		forwardSet = function (val) {
			descriptor.set(val);
			return forwardGet();
		};
	} else {
		forwardGet = function () {
			return descriptor.value;
		};
		forwardSet = function (val) {
			descriptor.value = val;
			return val;
		};
	}

	function wrapCustomHook(hook) {
		return function (module, filename) {
			// We wrap every added extension, but we only apply the transform to the one on top of the stack
			if (!module[key]) {
				module[key] = true;

				const originalCompile = module._compile;

				// eslint-disable-next-line func-name-matching func-names
				module._compile = function replacementCompile(code, filename) {
					module._compile = originalCompile;
					code = transform(code, filename);
					module._compile(code, filename);
				};
			}

			hook(module, filename);
		};
	}

	// Wrap the original
	forwardSet(wrapCustomHook(forwardGet()));

	const hooks = [forwardGet()];

	function setCurrentHook(hook) {
		const restoreIndex = hooks.indexOf(hook);

		if (restoreIndex === -1) {
			hooks.push(forwardSet(wrapCustomHook(hook)));
		} else {
			// We have already scene this hook, and it is being reverted (proxyquire, etc) - don't wrap again.
			hooks.splice(restoreIndex + 1, hooks.length);
			forwardSet(hook);
		}
	}

	Object.defineProperty(extensions, ext, {
		configurable: true,
		enumerable: true,
		get: forwardGet,
		set: setCurrentHook
	});
}
