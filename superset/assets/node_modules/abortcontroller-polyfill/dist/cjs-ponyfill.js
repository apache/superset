'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

var get = function get(object, property, receiver) {
  if (object === null) object = Function.prototype;
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc) {
    return desc.value;
  } else {
    var getter = desc.get;

    if (getter === undefined) {
      return undefined;
    }

    return getter.call(receiver);
  }
};

var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};

var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};

var Emitter = function () {
  function Emitter() {
    classCallCheck(this, Emitter);

    this.listeners = {};
  }

  createClass(Emitter, [{
    key: 'addEventListener',
    value: function addEventListener(type, callback) {
      if (!(type in this.listeners)) {
        this.listeners[type] = [];
      }
      this.listeners[type].push(callback);
    }
  }, {
    key: 'removeEventListener',
    value: function removeEventListener(type, callback) {
      if (!(type in this.listeners)) {
        return;
      }
      var stack = this.listeners[type];
      for (var i = 0, l = stack.length; i < l; i++) {
        if (stack[i] === callback) {
          stack.splice(i, 1);
          return;
        }
      }
    }
  }, {
    key: 'dispatchEvent',
    value: function dispatchEvent(event) {
      var _this = this;

      if (!(event.type in this.listeners)) {
        return;
      }
      var debounce = function debounce(callback) {
        setTimeout(function () {
          return callback.call(_this, event);
        });
      };
      var stack = this.listeners[event.type];
      for (var i = 0, l = stack.length; i < l; i++) {
        debounce(stack[i]);
      }
      return !event.defaultPrevented;
    }
  }]);
  return Emitter;
}();

var AbortSignal = function (_Emitter) {
  inherits(AbortSignal, _Emitter);

  function AbortSignal() {
    classCallCheck(this, AbortSignal);

    var _this2 = possibleConstructorReturn(this, (AbortSignal.__proto__ || Object.getPrototypeOf(AbortSignal)).call(this));

    _this2.aborted = false;
    _this2.onabort = null;
    return _this2;
  }

  createClass(AbortSignal, [{
    key: 'toString',
    value: function toString() {
      return '[object AbortSignal]';
    }
  }, {
    key: 'dispatchEvent',
    value: function dispatchEvent(event) {
      if (event.type === 'abort') {
        this.aborted = true;
        if (typeof this.onabort === 'function') {
          this.onabort.call(this, event);
        }
      }

      get(AbortSignal.prototype.__proto__ || Object.getPrototypeOf(AbortSignal.prototype), 'dispatchEvent', this).call(this, event);
    }
  }]);
  return AbortSignal;
}(Emitter);

var AbortController = function () {
  function AbortController() {
    classCallCheck(this, AbortController);

    this.signal = new AbortSignal();
  }

  createClass(AbortController, [{
    key: 'abort',
    value: function abort() {
      var event = void 0;
      try {
        event = new Event('abort');
      } catch (e) {
        if (typeof document !== 'undefined') {
          // For Internet Explorer 11:
          event = document.createEvent('Event');
          event.initEvent('abort', false, false);
        } else {
          // Fallback where document isn't available:
          event = {
            type: 'abort',
            bubbles: false,
            cancelable: false
          };
        }
      }
      this.signal.dispatchEvent(event);
    }
  }, {
    key: 'toString',
    value: function toString() {
      return '[object AbortController]';
    }
  }]);
  return AbortController;
}();

if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
  // These are necessary to make sure that we get correct output for:
  // Object.prototype.toString.call(new AbortController())
  AbortController.prototype[Symbol.toStringTag] = 'AbortController';
  AbortSignal.prototype[Symbol.toStringTag] = 'AbortSignal';
}

/**
 * Note: the "fetch.Request" default value is available for fetch imported from
 * the "node-fetch" package and not in browsers. This is OK since browsers
 * will be importing umd-polyfill.js from that path "self" is passed the
 * decorator so the default value will not be used (because browsers that define
 * fetch also has Request). One quirky setup where self.fetch exists but
 * self.Request does not is when the "unfetch" minimal fetch polyfill is used
 * on top of IE11; for this case the browser will try to use the fetch.Request
 * default value which in turn will be undefined but then then "if (Request)"
 * will ensure that you get a patched fetch but still no Request (as expected).
 * @param {fetch, Request = fetch.Request}
 * @returns {fetch: abortableFetch, Request: AbortableRequest}
 */
function abortableFetchDecorator(patchTargets) {
  if ('function' === typeof patchTargets) {
    patchTargets = { fetch: patchTargets };
  }
  var _patchTargets = patchTargets,
      fetch = _patchTargets.fetch,
      _patchTargets$Request = _patchTargets.Request,
      NativeRequest = _patchTargets$Request === undefined ? fetch.Request : _patchTargets$Request,
      _patchTargets$AbortCo = _patchTargets.AbortController,
      NativeAbortController = _patchTargets$AbortCo === undefined ? AbortController : _patchTargets$AbortCo;


  var Request = NativeRequest;
  // Note that the "unfetch" minimal fetch polyfill defines fetch() without
  // defining window.Request, and this polyfill need to work on top of unfetch
  // so the below feature detection is wrapped in if (Request)
  if (Request) {
    // Do feature detecting
    var controller = new NativeAbortController();
    var signal = controller.signal;
    var request = new Request('/', { signal: signal });

    // Browser already supports abortable fetch (like FF v57 and fetch-polyfill)
    if (request.signal) {
      return { fetch: fetch, Request: Request };
    }

    Request = function Request(input, init) {
      var request = new NativeRequest(input, init);
      if (init && init.signal) {
        request.signal = init.signal;
      }
      return request;
    };
    Request.prototype = NativeRequest.prototype;
  }

  var realFetch = fetch;
  var abortableFetch = function abortableFetch(input, init) {
    var signal = Request && Request.prototype.isPrototypeOf(input) ? input.signal : init ? init.signal : undefined;

    if (signal) {
      var abortError = void 0;
      try {
        abortError = new DOMException('Aborted', 'AbortError');
      } catch (err) {
        // IE 11 does not support calling the DOMException constructor, use a
        // regular error object on it instead.
        abortError = new Error('Aborted');
        abortError.name = 'AbortError';
      }

      // Return early if already aborted, thus avoiding making an HTTP request
      if (signal.aborted) {
        return Promise.reject(abortError);
      }

      // Turn an event into a promise, reject it once `abort` is dispatched
      var cancellation = new Promise(function (_, reject) {
        signal.addEventListener('abort', function () {
          return reject(abortError);
        }, { once: true });
      });

      // Return the fastest promise (don't need to wait for request to finish)
      return Promise.race([cancellation, realFetch(input, init)]);
    }

    return realFetch(input, init);
  };

  return { fetch: abortableFetch, Request: Request };
}

exports.AbortController = AbortController;
exports.AbortSignal = AbortSignal;
exports.abortableFetch = abortableFetchDecorator;
