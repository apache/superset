"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const HTMLElement = require("./HTMLElement.js");
const impl = utils.implSymbol;

function HTMLMediaElement() {
  throw new TypeError("Illegal constructor");
}
HTMLMediaElement.prototype = Object.create(HTMLElement.interface.prototype);
HTMLMediaElement.prototype.constructor = HTMLMediaElement;


HTMLMediaElement.prototype.load = function load() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return this[impl].load.apply(this[impl], args);
};

HTMLMediaElement.prototype.canPlayType = function canPlayType(type) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to execute 'canPlayType' on 'HTMLMediaElement': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 1; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  args[0] = conversions["DOMString"](args[0]);
  return utils.tryWrapperForImpl(this[impl].canPlayType.apply(this[impl], args));
};

HTMLMediaElement.prototype.play = function play() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return this[impl].play.apply(this[impl], args);
};

HTMLMediaElement.prototype.pause = function pause() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return this[impl].pause.apply(this[impl], args);
};

HTMLMediaElement.prototype.addTextTrack = function addTextTrack(kind) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to execute 'addTextTrack' on 'HTMLMediaElement': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 3; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  if (args[1] !== undefined) {
  args[1] = conversions["DOMString"](args[1]);
  } else {
    args[1] = "";
  }
  if (args[2] !== undefined) {
  args[2] = conversions["DOMString"](args[2]);
  } else {
    args[2] = "";
  }
  return utils.tryWrapperForImpl(this[impl].addTextTrack.apply(this[impl], args));
};

HTMLMediaElement.prototype.toString = function () {
  if (this === HTMLMediaElement.prototype) {
    return "[object HTMLMediaElementPrototype]";
  }
  return HTMLElement.interface.prototype.toString.call(this);
};
Object.defineProperty(HTMLMediaElement.prototype, "src", {
  get() {
    return this[impl].src;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this[impl].src = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "currentSrc", {
  get() {
    return this[impl].currentSrc;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "crossOrigin", {
  get() {
    const value = this.getAttribute("crossOrigin");
    return value === null ? "" : value;
  },
  set(V) {
    if (V === null || V === undefined) {
      V = null;
    } else {
    V = conversions["DOMString"](V);
    }
    this.setAttribute("crossOrigin", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement, "NETWORK_EMPTY", {
  value: 0,
  enumerable: true
});
Object.defineProperty(HTMLMediaElement.prototype, "NETWORK_EMPTY", {
  value: 0,
  enumerable: true
});

Object.defineProperty(HTMLMediaElement, "NETWORK_IDLE", {
  value: 1,
  enumerable: true
});
Object.defineProperty(HTMLMediaElement.prototype, "NETWORK_IDLE", {
  value: 1,
  enumerable: true
});

Object.defineProperty(HTMLMediaElement, "NETWORK_LOADING", {
  value: 2,
  enumerable: true
});
Object.defineProperty(HTMLMediaElement.prototype, "NETWORK_LOADING", {
  value: 2,
  enumerable: true
});

Object.defineProperty(HTMLMediaElement, "NETWORK_NO_SOURCE", {
  value: 3,
  enumerable: true
});
Object.defineProperty(HTMLMediaElement.prototype, "NETWORK_NO_SOURCE", {
  value: 3,
  enumerable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "networkState", {
  get() {
    return this[impl].networkState;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "preload", {
  get() {
    const value = this.getAttribute("preload");
    return value === null ? "" : value;
  },
  set(V) {
    V = conversions["DOMString"](V);
    this.setAttribute("preload", V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "buffered", {
  get() {
    return utils.tryWrapperForImpl(this[impl].buffered);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement, "HAVE_NOTHING", {
  value: 0,
  enumerable: true
});
Object.defineProperty(HTMLMediaElement.prototype, "HAVE_NOTHING", {
  value: 0,
  enumerable: true
});

Object.defineProperty(HTMLMediaElement, "HAVE_METADATA", {
  value: 1,
  enumerable: true
});
Object.defineProperty(HTMLMediaElement.prototype, "HAVE_METADATA", {
  value: 1,
  enumerable: true
});

Object.defineProperty(HTMLMediaElement, "HAVE_CURRENT_DATA", {
  value: 2,
  enumerable: true
});
Object.defineProperty(HTMLMediaElement.prototype, "HAVE_CURRENT_DATA", {
  value: 2,
  enumerable: true
});

Object.defineProperty(HTMLMediaElement, "HAVE_FUTURE_DATA", {
  value: 3,
  enumerable: true
});
Object.defineProperty(HTMLMediaElement.prototype, "HAVE_FUTURE_DATA", {
  value: 3,
  enumerable: true
});

Object.defineProperty(HTMLMediaElement, "HAVE_ENOUGH_DATA", {
  value: 4,
  enumerable: true
});
Object.defineProperty(HTMLMediaElement.prototype, "HAVE_ENOUGH_DATA", {
  value: 4,
  enumerable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
  get() {
    return this[impl].readyState;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "seeking", {
  get() {
    return this[impl].seeking;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
  get() {
    return this[impl].currentTime;
  },
  set(V) {
    V = conversions["double"](V);
    this[impl].currentTime = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "duration", {
  get() {
    return this[impl].duration;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "paused", {
  get() {
    return this[impl].paused;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "defaultPlaybackRate", {
  get() {
    return this[impl].defaultPlaybackRate;
  },
  set(V) {
    V = conversions["double"](V);
    this[impl].defaultPlaybackRate = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "playbackRate", {
  get() {
    return this[impl].playbackRate;
  },
  set(V) {
    V = conversions["double"](V);
    this[impl].playbackRate = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "played", {
  get() {
    return utils.tryWrapperForImpl(this[impl].played);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "seekable", {
  get() {
    return utils.tryWrapperForImpl(this[impl].seekable);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "ended", {
  get() {
    return this[impl].ended;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "autoplay", {
  get() {
    return this.hasAttribute("autoplay");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("autoplay", "");
  } else {
    this.removeAttribute("autoplay");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "loop", {
  get() {
    return this.hasAttribute("loop");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("loop", "");
  } else {
    this.removeAttribute("loop");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "controls", {
  get() {
    return this.hasAttribute("controls");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("controls", "");
  } else {
    this.removeAttribute("controls");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "volume", {
  get() {
    return this[impl].volume;
  },
  set(V) {
    V = conversions["double"](V);
    this[impl].volume = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "muted", {
  get() {
    return this[impl].muted;
  },
  set(V) {
    V = conversions["boolean"](V);
    this[impl].muted = V;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "defaultMuted", {
  get() {
    return this.hasAttribute("muted");
  },
  set(V) {
    V = conversions["boolean"](V);
    if (V) {
    this.setAttribute("muted", "");
  } else {
    this.removeAttribute("muted");
  }
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "audioTracks", {
  get() {
    return utils.tryWrapperForImpl(this[impl].audioTracks);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "videoTracks", {
  get() {
    return utils.tryWrapperForImpl(this[impl].videoTracks);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(HTMLMediaElement.prototype, "textTracks", {
  get() {
    return utils.tryWrapperForImpl(this[impl].textTracks);
  },
  enumerable: true,
  configurable: true
});


const iface = {
  mixedInto: [],
  is(obj) {
    if (obj) {
      if (obj[impl] instanceof Impl.implementation) {
        return true;
      }
      for (let i = 0; i < module.exports.mixedInto.length; ++i) {
        if (obj instanceof module.exports.mixedInto[i]) {
          return true;
        }
      }
    }
    return false;
  },
  isImpl(obj) {
    if (obj) {
      if (obj instanceof Impl.implementation) {
        return true;
      }

      const wrapper = utils.wrapperForImpl(obj);
      for (let i = 0; i < module.exports.mixedInto.length; ++i) {
        if (wrapper instanceof module.exports.mixedInto[i]) {
          return true;
        }
      }
    }
    return false;
  },
  create(constructorArgs, privateData) {
    let obj = Object.create(HTMLMediaElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLMediaElement.prototype);
    this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    HTMLElement._internalSetup(obj);

  },
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};
    privateData.wrapper = obj;

    this._internalSetup(obj);

    obj[impl] = new Impl.implementation(constructorArgs, privateData);
    obj[impl][utils.wrapperSymbol] = obj;
  },
  interface: HTMLMediaElement,
  expose: {
    Window: { HTMLMediaElement: HTMLMediaElement }
  }
};
module.exports = iface;

const Impl = require("../nodes/HTMLMediaElement-impl.js");
