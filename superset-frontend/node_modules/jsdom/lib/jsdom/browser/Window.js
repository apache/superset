"use strict";

const webIDLConversions = require("webidl-conversions");
const CSSStyleDeclaration = require("cssstyle").CSSStyleDeclaration;
const notImplemented = require("./not-implemented");
const VirtualConsole = require("../virtual-console");
const define = require("../utils").define;
const EventTarget = require("../living/generated/EventTarget");
const namedPropertiesWindow = require("../living/named-properties-window");
const cssom = require("cssom");
const postMessage = require("../living/post-message");
const DOMException = require("../web-idl/DOMException");
const btoa = require("abab").btoa;
const atob = require("abab").atob;
const idlUtils = require("../living/generated/utils");
const createXMLHttpRequest = require("../living/xmlhttprequest");
const createFileReader = require("../living/generated/FileReader").createInterface;
const Document = require("../living/generated/Document");
const Navigator = require("../living/generated/Navigator");
const reportException = require("../living/helpers/runtime-script-errors");

// NB: the require() must be after assigning `module.exports` because this require() is circular
// TODO: this above note might not even be true anymore... figure out the cycle and document it, or clean up.
module.exports = Window;
const dom = require("../living");

const cssSelectorSplitRE = /((?:[^,"']|"[^"]*"|'[^']*')+)/;

const defaultStyleSheet = cssom.parse(require("./default-stylesheet"));

dom.Window = Window;

// NOTE: per https://heycam.github.io/webidl/#Global, all properties on the Window object must be own-properties.
// That is why we assign everything inside of the constructor, instead of using a shared prototype.
// You can verify this in e.g. Firefox or Internet Explorer, which do a good job with Web IDL compliance.

function Window(options) {
  EventTarget.setup(this);

  const window = this;

  ///// INTERFACES FROM THE DOM
  // TODO: consider a mode of some sort where these are not shared between all DOM instances
  // It'd be very memory-expensive in most cases, though.
  for (const name in dom) {
    Object.defineProperty(window, name, {
      enumerable: false,
      configurable: true,
      writable: true,
      value: dom[name]
    });
  }
  this._core = dom;

  ///// PRIVATE DATA PROPERTIES

  // vm initialization is defered until script processing is activated (in level1/core)
  this._globalProxy = this;

  this.__timers = Object.create(null);

  // Set up the window as if it's a top level window.
  // If it's not, then references will be corrected by frame/iframe code.
  this._parent = this._top = this._globalProxy;
  this._frameElement = null;

  // List options explicitly to be clear which are passed through
  this._document = Document.create([], {
    core: dom,
    options: {
      parsingMode: options.parsingMode,
      contentType: options.contentType,
      encoding: options.encoding,
      cookieJar: options.cookieJar,
      parser: options.parser,
      url: options.url,
      lastModified: options.lastModified,
      referrer: options.referrer,
      cookie: options.cookie,
      deferClose: options.deferClose,
      resourceLoader: options.resourceLoader,
      concurrentNodeIterators: options.concurrentNodeIterators,
      pool: options.pool,
      agent: options.agent,
      agentClass: options.agentClass,
      agentOptions: options.agentOptions,
      strictSSL: options.strictSSL,
      proxy: options.proxy,
      defaultView: this._globalProxy,
      global: this
    }
  });
  // https://html.spec.whatwg.org/#session-history
  this._sessionHistory = [{
    document: idlUtils.implForWrapper(this._document),
    url: idlUtils.implForWrapper(this._document)._URL,
    stateObject: null
  }];
  this._currentSessionHistoryEntryIndex = 0;


  // This implements window.frames.length, since window.frames returns a
  // self reference to the window object.  This value is incremented in the
  // HTMLFrameElement init function (see: level2/html.js).
  this._length = 0;

  if (options.virtualConsole) {
    if (options.virtualConsole instanceof VirtualConsole) {
      this._virtualConsole = options.virtualConsole;
    } else {
      throw new TypeError(
        "options.virtualConsole must be a VirtualConsole (from createVirtualConsole)");
    }
  } else {
    this._virtualConsole = new VirtualConsole();
  }

  ///// GETTERS

  const navigator = Navigator.create([], { userAgent: options.userAgent });

  define(this, {
    get length() {
      return window._length;
    },
    get window() {
      return window._globalProxy;
    },
    get frameElement() {
      return window._frameElement;
    },
    get frames() {
      return window._globalProxy;
    },
    get self() {
      return window._globalProxy;
    },
    get parent() {
      return window._parent;
    },
    get top() {
      return window._top;
    },
    get document() {
      return window._document;
    },
    get location() {
      return idlUtils.wrapperForImpl(idlUtils.implForWrapper(window._document)._location);
    },
    get history() {
      return idlUtils.wrapperForImpl(idlUtils.implForWrapper(window._document)._history);
    },
    get navigator() {
      return navigator;
    }
  });

  namedPropertiesWindow.initializeWindow(this, dom.HTMLCollection);

  ///// METHODS for [ImplicitThis] hack
  // See https://lists.w3.org/Archives/Public/public-script-coord/2015JanMar/0109.html
  this.addEventListener = this.addEventListener.bind(this);
  this.removeEventListener = this.removeEventListener.bind(this);
  this.dispatchEvent = this.dispatchEvent.bind(this);

  ///// METHODS

  let latestTimerId = 0;

  this.setTimeout = function (fn, ms) {
    const args = [];
    for (let i = 2; i < arguments.length; ++i) {
      args[i - 2] = arguments[i];
    }
    return startTimer(window, setTimeout, clearTimeout, ++latestTimerId, fn, ms, args);
  };
  this.setInterval = function (fn, ms) {
    const args = [];
    for (let i = 2; i < arguments.length; ++i) {
      args[i - 2] = arguments[i];
    }
    return startTimer(window, setInterval, clearInterval, ++latestTimerId, fn, ms, args);
  };
  this.clearInterval = stopTimer.bind(this, window);
  this.clearTimeout = stopTimer.bind(this, window);
  this.__stopAllTimers = stopAllTimers.bind(this, window);

  function Option(text, value, defaultSelected, selected) {
    if (text === undefined) {
      text = "";
    }
    text = webIDLConversions.DOMString(text);

    if (value !== undefined) {
      value = webIDLConversions.DOMString(value);
    }

    defaultSelected = webIDLConversions.boolean(defaultSelected);
    selected = webIDLConversions.boolean(selected);

    const option = window._document.createElement("option");
    const impl = idlUtils.implForWrapper(option);

    if (text !== "") {
      impl.text = text;
    }
    if (value !== undefined) {
      impl.setAttribute("value", value);
    }
    if (defaultSelected) {
      impl.setAttribute("selected", "");
    }
    impl._selectedness = selected;

    return option;
  }
  Object.defineProperty(Option, "prototype", {
    value: this.HTMLOptionElement.prototype,
    configurable: false,
    enumerable: false,
    writable: false
  });
  Object.defineProperty(window, "Option", {
    value: Option,
    configurable: true,
    enumerable: false,
    writable: true
  });

  function Image() {
    const img = window._document.createElement("img");
    const impl = idlUtils.implForWrapper(img);

    if (arguments.length > 0) {
      impl.setAttribute("width", String(arguments[0]));
    }
    if (arguments.length > 1) {
      impl.setAttribute("height", String(arguments[1]));
    }

    return img;
  }
  Object.defineProperty(Image, "prototype", {
    value: this.HTMLImageElement.prototype,
    configurable: false,
    enumerable: false,
    writable: false
  });
  Object.defineProperty(window, "Image", {
    value: Image,
    configurable: true,
    enumerable: false,
    writable: true
  });

  function Audio(src) {
    const audio = window._document.createElement("audio");
    const impl = idlUtils.implForWrapper(audio);
    impl.setAttribute("preload", "auto");

    if (src !== undefined) {
      impl.setAttribute("src", String(src));
    }

    return audio;
  }
  Object.defineProperty(Audio, "prototype", {
    value: this.HTMLAudioElement.prototype,
    configurable: false,
    enumerable: false,
    writable: false
  });
  Object.defineProperty(window, "Audio", {
    value: Audio,
    configurable: true,
    enumerable: false,
    writable: true
  });

  function wrapConsoleMethod(method) {
    return function () {
      const args = Array.prototype.slice.call(arguments);
      window._virtualConsole.emit.apply(window._virtualConsole, [method].concat(args));
    };
  }

  this.postMessage = postMessage;

  this.atob = function (str) {
    const result = atob(str);
    if (result === null) {
      throw new DOMException(DOMException.INVALID_CHARACTER_ERR,
        "The string to be decoded contains invalid characters.");
    }
    return result;
  };

  this.btoa = function (str) {
    const result = btoa(str);
    if (result === null) {
      throw new DOMException(DOMException.INVALID_CHARACTER_ERR,
        "The string to be encoded contains invalid characters.");
    }
    return result;
  };

  this.FileReader = createFileReader({
    window: this
  }).interface;

  this.XMLHttpRequest = createXMLHttpRequest(this);

  // TODO: necessary for Blob and FileReader due to different-globals weirdness; investigate how to avoid this.
  this.ArrayBuffer = ArrayBuffer;
  this.Int8Array = Int8Array;
  this.Uint8Array = Uint8Array;
  this.Uint8ClampedArray = Uint8ClampedArray;
  this.Int16Array = Int16Array;
  this.Uint16Array = Uint16Array;
  this.Int32Array = Int32Array;
  this.Uint32Array = Uint32Array;
  this.Float32Array = Float32Array;
  this.Float64Array = Float64Array;

  this.stop = function () {
    const manager = idlUtils.implForWrapper(this._document)._requestManager;
    if (manager) {
      manager.close();
    }
  };

  this.close = function () {
    // Recursively close child frame windows, then ourselves.
    const currentWindow = this;
    (function windowCleaner(windowToClean) {
      for (let i = 0; i < windowToClean.length; i++) {
        windowCleaner(windowToClean[i]);
      }

      // We"re already in our own window.close().
      if (windowToClean !== currentWindow) {
        windowToClean.close();
      }
    }(this));

    // Clear out all listeners. Any in-flight or upcoming events should not get delivered.
    idlUtils.implForWrapper(this)._eventListeners = Object.create(null);

    if (this._document) {
      if (this._document.body) {
        this._document.body.innerHTML = "";
      }

      if (this._document.close) {
        // It's especially important to clear out the listeners here because document.close() causes a "load" event to
        // fire.
        idlUtils.implForWrapper(this._document)._eventListeners = Object.create(null);
        this._document.close();
      }
      const doc = idlUtils.implForWrapper(this._document);
      if (doc._requestManager) {
        doc._requestManager.close();
      }
      delete this._document;
    }

    stopAllTimers(currentWindow);
  };

  this.getComputedStyle = function (node) {
    const s = node.style;
    const cs = new CSSStyleDeclaration();
    const forEach = Array.prototype.forEach;

    function setPropertiesFromRule(rule) {
      if (!rule.selectorText) {
        return;
      }

      const selectors = rule.selectorText.split(cssSelectorSplitRE);
      let matched = false;
      for (const selectorText of selectors) {
        if (selectorText !== "" && selectorText !== "," && !matched && matchesDontThrow(node, selectorText)) {
          matched = true;
          forEach.call(rule.style, property => {
            cs.setProperty(property, rule.style.getPropertyValue(property), rule.style.getPropertyPriority(property));
          });
        }
      }
    }

    function readStylesFromStyleSheet(sheet) {
      forEach.call(sheet.cssRules, rule => {
        if (rule.media) {
          if (Array.prototype.indexOf.call(rule.media, "screen") !== -1) {
            forEach.call(rule.cssRules, setPropertiesFromRule);
          }
        } else {
          setPropertiesFromRule(rule);
        }
      });
    }

    readStylesFromStyleSheet(defaultStyleSheet);
    forEach.call(node.ownerDocument.styleSheets, readStylesFromStyleSheet);

    forEach.call(s, property => {
      cs.setProperty(property, s.getPropertyValue(property), s.getPropertyPriority(property));
    });

    return cs;
  };

  ///// PUBLIC DATA PROPERTIES (TODO: should be getters)

  this.console = {
    assert: wrapConsoleMethod("assert"),
    clear: wrapConsoleMethod("clear"),
    count: wrapConsoleMethod("count"),
    debug: wrapConsoleMethod("debug"),
    error: wrapConsoleMethod("error"),
    group: wrapConsoleMethod("group"),
    groupCollapsed: wrapConsoleMethod("groupCollapsed"),
    groupEnd: wrapConsoleMethod("groupEnd"),
    info: wrapConsoleMethod("info"),
    log: wrapConsoleMethod("log"),
    table: wrapConsoleMethod("table"),
    time: wrapConsoleMethod("time"),
    timeEnd: wrapConsoleMethod("timeEnd"),
    trace: wrapConsoleMethod("trace"),
    warn: wrapConsoleMethod("warn")
  };

  function notImplementedMethod(name) {
    return function () {
      notImplemented(name, window);
    };
  }

  define(this, {
    name: "nodejs",
    innerWidth: 1024,
    innerHeight: 768,
    outerWidth: 1024,
    outerHeight: 768,
    pageXOffset: 0,
    pageYOffset: 0,
    screenX: 0,
    screenY: 0,
    screenLeft: 0,
    screenTop: 0,
    scrollX: 0,
    scrollY: 0,
    scrollTop: 0,
    scrollLeft: 0,
    screen: {
      width: 0,
      height: 0
    },

    alert: notImplementedMethod("window.alert"),
    blur: notImplementedMethod("window.blur"),
    confirm: notImplementedMethod("window.confirm"),
    createPopup: notImplementedMethod("window.createPopup"),
    focus: notImplementedMethod("window.focus"),
    moveBy: notImplementedMethod("window.moveBy"),
    moveTo: notImplementedMethod("window.moveTo"),
    open: notImplementedMethod("window.open"),
    print: notImplementedMethod("window.print"),
    prompt: notImplementedMethod("window.prompt"),
    resizeBy: notImplementedMethod("window.resizeBy"),
    resizeTo: notImplementedMethod("window.resizeTo"),
    scroll: notImplementedMethod("window.scroll"),
    scrollBy: notImplementedMethod("window.scrollBy"),
    scrollTo: notImplementedMethod("window.scrollTo"),

    toString: () => {
      return "[object Window]";
    }
  });

  ///// INITIALIZATION

  process.nextTick(() => {
    if (!window.document) {
      return; // window might've been closed already
    }

    if (window.document.readyState === "complete") {
      const ev = window.document.createEvent("HTMLEvents");
      ev.initEvent("load", false, false);
      window.dispatchEvent(ev);
    } else {
      window.document.addEventListener("load", () => {
        const ev = window.document.createEvent("HTMLEvents");
        ev.initEvent("load", false, false);
        window.dispatchEvent(ev);
      });
    }
  });
}

Object.setPrototypeOf(Window, EventTarget.interface);
Object.setPrototypeOf(Window.prototype, EventTarget.interface.prototype);

function matchesDontThrow(el, selector) {
  try {
    return el.matches(selector);
  } catch (e) {
    return false;
  }
}

function startTimer(window, startFn, stopFn, timerId, callback, ms, args) {
  if (typeof callback !== "function") {
    const code = String(callback);
    callback = window._globalProxy.eval.bind(window, code + `\n//# sourceURL=${window.location.href}`);
  }

  const oldCallback = callback;
  callback = () => {
    try {
      oldCallback.apply(window._globalProxy, args);
    } catch (e) {
      reportException(window, e, window.location.href);
    }
  };

  const res = startFn(callback, ms);
  window.__timers[timerId] = [res, stopFn];
  return timerId;
}

function stopTimer(window, id) {
  const timer = window.__timers[id];
  if (timer) {
    // Need to .call() with undefined to ensure the thisArg is not timer itself
    timer[1].call(undefined, timer[0]);
    delete window.__timers[id];
  }
}

function stopAllTimers(window) {
  Object.keys(window.__timers).forEach(key => {
    const timer = window.__timers[key];
    // Need to .call() with undefined to ensure the thisArg is not timer itself
    timer[1].call(undefined, timer[0]);
  });
  window.__timers = Object.create(null);
}
