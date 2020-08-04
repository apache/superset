(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Tesseract = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';
/* eslint-disable no-unused-vars */
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (e) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

module.exports = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (Object.getOwnPropertySymbols) {
			symbols = Object.getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

},{}],2:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],3:[function(require,module,exports){
module.exports={
  "name": "tesseract.js",
  "version": "1.0.10",
  "description": "Pure Javascript Multilingual OCR",
  "main": "src/index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" & exit 1",
    "start": "watchify src/index.js  -t [ envify --NODE_ENV development ] -t [ babelify --presets [ es2015 ] ] -o dist/tesseract.dev.js --standalone Tesseract & watchify src/browser/worker.js  -t [ envify --NODE_ENV development ] -t [ babelify --presets [ es2015 ] ] -o dist/worker.dev.js & http-server -p 7355",
    "build": "browserify src/index.js -t [ babelify --presets [ es2015 ] ] -o dist/tesseract.js --standalone Tesseract && browserify src/browser/worker.js -t [ babelify --presets [ es2015 ] ] -o dist/worker.js",
    "release": "npm run build && git commit -am 'new release' && git push && git tag `jq -r '.version' package.json` && git push origin --tags && npm publish"
  },
  "browser": {
    "./src/node/index.js": "./src/browser/index.js"
  },
  "author": "",
  "license": "Apache-2.0",
  "devDependencies": {
    "babel-preset-es2015": "^6.16.0",
    "babelify": "^7.3.0",
    "browserify": "^13.1.0",
    "envify": "^3.4.1",
    "http-server": "^0.9.0",
    "pako": "^1.0.3",
    "watchify": "^3.7.0"
  },
  "dependencies": {
    "file-type": "^3.8.0",
    "is-url": "^1.2.2",
    "jpeg-js": "^0.2.0",
    "level-js": "^2.2.4",
    "node-fetch": "^1.6.3",
    "object-assign": "^4.1.0",
    "png.js": "^0.2.1",
    "tesseract.js-core": "^1.0.2"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/naptha/tesseract.js.git"
  },
  "bugs": {
    "url": "https://github.com/naptha/tesseract.js/issues"
  },
  "homepage": "https://github.com/naptha/tesseract.js"
}

},{}],4:[function(require,module,exports){
(function (process){
'use strict';

var defaultOptions = {
    // workerPath: 'https://cdn.rawgit.com/naptha/tesseract.js/0.2.0/dist/worker.js',
    corePath: 'https://cdn.rawgit.com/naptha/tesseract.js-core/0.1.0/index.js',
    langPath: 'https://cdn.rawgit.com/naptha/tessdata/gh-pages/3.02/'
};

if (process.env.NODE_ENV === "development") {
    console.debug('Using Development Configuration');
    defaultOptions.workerPath = location.protocol + '//' + location.host + '/dist/worker.dev.js?nocache=' + Math.random().toString(36).slice(3);
} else {
    var version = require('../../package.json').version;
    defaultOptions.workerPath = 'https://cdn.rawgit.com/naptha/tesseract.js/' + version + '/dist/worker.js';
}

exports.defaultOptions = defaultOptions;

exports.spawnWorker = function spawnWorker(instance, workerOptions) {
    if (window.Blob && window.URL) {
        var blob = new Blob(['importScripts("' + workerOptions.workerPath + '");']);
        var worker = new Worker(window.URL.createObjectURL(blob));
    } else {
        var worker = new Worker(workerOptions.workerPath);
    }

    worker.onmessage = function (e) {
        var packet = e.data;
        instance._recv(packet);
    };
    return worker;
};

exports.terminateWorker = function (instance) {
    instance.worker.terminate();
};

exports.sendPacket = function sendPacket(instance, packet) {
    loadImage(packet.payload.image, function (img) {
        packet.payload.image = img;
        instance.worker.postMessage(packet);
    });
};

function loadImage(image, cb) {
    if (typeof image === 'string') {
        if (/^\#/.test(image)) {
            // element css selector
            return loadImage(document.querySelector(image), cb);
        } else if (/(blob|data)\:/.test(image)) {
            // data url
            var im = new Image();
            im.src = image;
            im.onload = function (e) {
                return loadImage(im, cb);
            };
            return;
        } else {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', image, true);
            xhr.responseType = "blob";
            xhr.onload = function (e) {
                return loadImage(xhr.response, cb);
            };
            xhr.onerror = function (e) {
                if (/^https?:\/\//.test(image) && !/^https:\/\/crossorigin.me/.test(image)) {
                    console.debug('Attempting to load image with CORS proxy');
                    loadImage('https://crossorigin.me/' + image, cb);
                }
            };
            xhr.send(null);
            return;
        }
    } else if (image instanceof File) {
        // files
        var fr = new FileReader();
        fr.onload = function (e) {
            return loadImage(fr.result, cb);
        };
        fr.readAsDataURL(image);
        return;
    } else if (image instanceof Blob) {
        return loadImage(URL.createObjectURL(image), cb);
    } else if (image.getContext) {
        // canvas element
        return loadImage(image.getContext('2d'), cb);
    } else if (image.tagName == "IMG" || image.tagName == "VIDEO") {
        // image element or video element
        var c = document.createElement('canvas');
        c.width = image.naturalWidth || image.videoWidth;
        c.height = image.naturalHeight || image.videoHeight;
        var ctx = c.getContext('2d');
        ctx.drawImage(image, 0, 0);
        return loadImage(ctx, cb);
    } else if (image.getImageData) {
        // canvas context
        var data = image.getImageData(0, 0, image.canvas.width, image.canvas.height);
        return loadImage(data, cb);
    } else {
        return cb(image);
    }
    throw new Error('Missing return in loadImage cascade');
}

}).call(this,require('_process'))
},{"../../package.json":3,"_process":2}],5:[function(require,module,exports){
"use strict";

// The result of dump.js is a big JSON tree
// which can be easily serialized (for instance
// to be sent from a webworker to the main app
// or through Node's IPC), but we want
// a (circular) DOM-like interface for walking
// through the data. 

module.exports = function circularize(page) {
    page.paragraphs = [];
    page.lines = [];
    page.words = [];
    page.symbols = [];

    page.blocks.forEach(function (block) {
        block.page = page;

        block.lines = [];
        block.words = [];
        block.symbols = [];

        block.paragraphs.forEach(function (para) {
            para.block = block;
            para.page = page;

            para.words = [];
            para.symbols = [];

            para.lines.forEach(function (line) {
                line.paragraph = para;
                line.block = block;
                line.page = page;

                line.symbols = [];

                line.words.forEach(function (word) {
                    word.line = line;
                    word.paragraph = para;
                    word.block = block;
                    word.page = page;
                    word.symbols.forEach(function (sym) {
                        sym.word = word;
                        sym.line = line;
                        sym.paragraph = para;
                        sym.block = block;
                        sym.page = page;

                        sym.line.symbols.push(sym);
                        sym.paragraph.symbols.push(sym);
                        sym.block.symbols.push(sym);
                        sym.page.symbols.push(sym);
                    });
                    word.paragraph.words.push(word);
                    word.block.words.push(word);
                    word.page.words.push(word);
                });
                line.block.lines.push(line);
                line.page.lines.push(line);
            });
            para.page.paragraphs.push(para);
        });
    });
    return page;
};

},{}],6:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var adapter = require('../node/index.js');

var jobCounter = 0;

module.exports = function () {
    function TesseractJob(instance) {
        _classCallCheck(this, TesseractJob);

        this.id = 'Job-' + ++jobCounter + '-' + Math.random().toString(16).slice(3, 8);

        this._instance = instance;
        this._resolve = [];
        this._reject = [];
        this._progress = [];
        this._finally = [];
    }

    _createClass(TesseractJob, [{
        key: 'then',
        value: function then(resolve, reject) {
            if (this._resolve.push) {
                this._resolve.push(resolve);
            } else {
                resolve(this._resolve);
            }

            if (reject) this.catch(reject);
            return this;
        }
    }, {
        key: 'catch',
        value: function _catch(reject) {
            if (this._reject.push) {
                this._reject.push(reject);
            } else {
                reject(this._reject);
            }
            return this;
        }
    }, {
        key: 'progress',
        value: function progress(fn) {
            this._progress.push(fn);
            return this;
        }
    }, {
        key: 'finally',
        value: function _finally(fn) {
            this._finally.push(fn);
            return this;
        }
    }, {
        key: '_send',
        value: function _send(action, payload) {
            adapter.sendPacket(this._instance, {
                jobId: this.id,
                action: action,
                payload: payload
            });
        }
    }, {
        key: '_handle',
        value: function _handle(packet) {
            var data = packet.data;
            var runFinallyCbs = false;

            if (packet.status === 'resolve') {
                if (this._resolve.length === 0) console.log(data);
                this._resolve.forEach(function (fn) {
                    var ret = fn(data);
                    if (ret && typeof ret.then == 'function') {
                        console.warn('TesseractJob instances do not chain like ES6 Promises. To convert it into a real promise, use Promise.resolve.');
                    }
                });
                this._resolve = data;
                this._instance._dequeue();
                runFinallyCbs = true;
            } else if (packet.status === 'reject') {
                if (this._reject.length === 0) console.error(data);
                this._reject.forEach(function (fn) {
                    return fn(data);
                });
                this._reject = data;
                this._instance._dequeue();
                runFinallyCbs = true;
            } else if (packet.status === 'progress') {
                this._progress.forEach(function (fn) {
                    return fn(data);
                });
            } else {
                console.warn('Message type unknown', packet.status);
            }

            if (runFinallyCbs) {
                this._finally.forEach(function (fn) {
                    return fn(data);
                });
            }
        }
    }]);

    return TesseractJob;
}();

},{"../node/index.js":4}],7:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var adapter = require('./node/index.js');
var circularize = require('./common/circularize.js');
var TesseractJob = require('./common/job');
var objectAssign = require('object-assign');
var version = require('../package.json').version;

function create(workerOptions) {
	workerOptions = workerOptions || {};
	var worker = new TesseractWorker(objectAssign({}, adapter.defaultOptions, workerOptions));
	worker.create = create;
	worker.version = version;
	return worker;
}

var TesseractWorker = function () {
	function TesseractWorker(workerOptions) {
		_classCallCheck(this, TesseractWorker);

		this.worker = null;
		this.workerOptions = workerOptions;
		this._currentJob = null;
		this._queue = [];
	}

	_createClass(TesseractWorker, [{
		key: 'recognize',
		value: function recognize(image, options) {
			var _this = this;

			return this._delay(function (job) {
				if (typeof options === 'string') {
					options = { lang: options };
				} else {
					options = options || {};
					options.lang = options.lang || 'eng';
				}

				job._send('recognize', { image: image, options: options, workerOptions: _this.workerOptions });
			});
		}
	}, {
		key: 'detect',
		value: function detect(image, options) {
			var _this2 = this;

			options = options || {};
			return this._delay(function (job) {
				job._send('detect', { image: image, options: options, workerOptions: _this2.workerOptions });
			});
		}
	}, {
		key: 'terminate',
		value: function terminate() {
			if (this.worker) adapter.terminateWorker(this);
			this.worker = null;
		}
	}, {
		key: '_delay',
		value: function _delay(fn) {
			var _this3 = this;

			if (!this.worker) this.worker = adapter.spawnWorker(this, this.workerOptions);

			var job = new TesseractJob(this);
			this._queue.push(function (e) {
				_this3._queue.shift();
				_this3._currentJob = job;
				fn(job);
			});
			if (!this._currentJob) this._dequeue();
			return job;
		}
	}, {
		key: '_dequeue',
		value: function _dequeue() {
			this._currentJob = null;
			if (this._queue.length > 0) {
				this._queue[0]();
			}
		}
	}, {
		key: '_recv',
		value: function _recv(packet) {

			if (packet.status === 'resolve' && packet.action === 'recognize') {
				packet.data = circularize(packet.data);
			}

			if (this._currentJob.id === packet.jobId) {
				this._currentJob._handle(packet);
			} else {
				console.warn('Job ID ' + packet.jobId + ' not known.');
			}
		}
	}]);

	return TesseractWorker;
}();

var DefaultTesseract = create();

module.exports = DefaultTesseract;

},{"../package.json":3,"./common/circularize.js":5,"./common/job":6,"./node/index.js":4,"object-assign":1}]},{},[7])(7)
});