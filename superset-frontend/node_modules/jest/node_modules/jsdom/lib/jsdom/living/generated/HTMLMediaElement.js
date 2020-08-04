"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const convertTextTrackKind = require("./TextTrackKind.js").convert;
const impl = utils.implSymbol;
const HTMLElement = require("./HTMLElement.js");

class HTMLMediaElement extends HTMLElement.interface {
  constructor() {
    throw new TypeError("Illegal constructor");
  }

  load() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].load();
  }

  canPlayType(type) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'canPlayType' on 'HTMLMediaElement': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'canPlayType' on 'HTMLMediaElement': parameter 1"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].canPlayType(...args));
  }

  play() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl].play());
  }

  pause() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].pause();
  }

  addTextTrack(kind) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'addTextTrack' on 'HTMLMediaElement': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = convertTextTrackKind(curArg, {
        context: "Failed to execute 'addTextTrack' on 'HTMLMediaElement': parameter 1"
      });
      args.push(curArg);
    }
    {
      let curArg = arguments[1];
      if (curArg !== undefined) {
        curArg = conversions["DOMString"](curArg, {
          context: "Failed to execute 'addTextTrack' on 'HTMLMediaElement': parameter 2"
        });
      } else {
        curArg = "";
      }
      args.push(curArg);
    }
    {
      let curArg = arguments[2];
      if (curArg !== undefined) {
        curArg = conversions["DOMString"](curArg, {
          context: "Failed to execute 'addTextTrack' on 'HTMLMediaElement': parameter 3"
        });
      } else {
        curArg = "";
      }
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].addTextTrack(...args));
  }

  get src() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["src"];
  }

  set src(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["USVString"](V, {
      context: "Failed to set the 'src' property on 'HTMLMediaElement': The provided value"
    });

    this[impl]["src"] = V;
  }

  get currentSrc() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["currentSrc"];
  }

  get crossOrigin() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "crossorigin");
    return value === null ? "" : value;
  }

  set crossOrigin(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (V === null || V === undefined) {
      V = null;
    } else {
      V = conversions["DOMString"](V, {
        context: "Failed to set the 'crossOrigin' property on 'HTMLMediaElement': The provided value"
      });
    }
    this[impl].setAttributeNS(null, "crossorigin", V);
  }

  get networkState() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["networkState"];
  }

  get preload() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "preload");
    return value === null ? "" : value;
  }

  set preload(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'preload' property on 'HTMLMediaElement': The provided value"
    });

    this[impl].setAttributeNS(null, "preload", V);
  }

  get buffered() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["buffered"]);
  }

  get readyState() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["readyState"];
  }

  get seeking() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["seeking"];
  }

  get currentTime() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["currentTime"];
  }

  set currentTime(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["double"](V, {
      context: "Failed to set the 'currentTime' property on 'HTMLMediaElement': The provided value"
    });

    this[impl]["currentTime"] = V;
  }

  get duration() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["duration"];
  }

  get paused() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["paused"];
  }

  get defaultPlaybackRate() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["defaultPlaybackRate"];
  }

  set defaultPlaybackRate(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["double"](V, {
      context: "Failed to set the 'defaultPlaybackRate' property on 'HTMLMediaElement': The provided value"
    });

    this[impl]["defaultPlaybackRate"] = V;
  }

  get playbackRate() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["playbackRate"];
  }

  set playbackRate(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["double"](V, {
      context: "Failed to set the 'playbackRate' property on 'HTMLMediaElement': The provided value"
    });

    this[impl]["playbackRate"] = V;
  }

  get played() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["played"]);
  }

  get seekable() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["seekable"]);
  }

  get ended() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["ended"];
  }

  get autoplay() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].hasAttributeNS(null, "autoplay");
  }

  set autoplay(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["boolean"](V, {
      context: "Failed to set the 'autoplay' property on 'HTMLMediaElement': The provided value"
    });

    if (V) {
      this[impl].setAttributeNS(null, "autoplay", "");
    } else {
      this[impl].removeAttributeNS(null, "autoplay");
    }
  }

  get loop() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].hasAttributeNS(null, "loop");
  }

  set loop(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["boolean"](V, {
      context: "Failed to set the 'loop' property on 'HTMLMediaElement': The provided value"
    });

    if (V) {
      this[impl].setAttributeNS(null, "loop", "");
    } else {
      this[impl].removeAttributeNS(null, "loop");
    }
  }

  get controls() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].hasAttributeNS(null, "controls");
  }

  set controls(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["boolean"](V, {
      context: "Failed to set the 'controls' property on 'HTMLMediaElement': The provided value"
    });

    if (V) {
      this[impl].setAttributeNS(null, "controls", "");
    } else {
      this[impl].removeAttributeNS(null, "controls");
    }
  }

  get volume() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["volume"];
  }

  set volume(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["double"](V, {
      context: "Failed to set the 'volume' property on 'HTMLMediaElement': The provided value"
    });

    this[impl]["volume"] = V;
  }

  get muted() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["muted"];
  }

  set muted(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["boolean"](V, {
      context: "Failed to set the 'muted' property on 'HTMLMediaElement': The provided value"
    });

    this[impl]["muted"] = V;
  }

  get defaultMuted() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].hasAttributeNS(null, "muted");
  }

  set defaultMuted(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["boolean"](V, {
      context: "Failed to set the 'defaultMuted' property on 'HTMLMediaElement': The provided value"
    });

    if (V) {
      this[impl].setAttributeNS(null, "muted", "");
    } else {
      this[impl].removeAttributeNS(null, "muted");
    }
  }

  get audioTracks() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "audioTracks", () => {
      return utils.tryWrapperForImpl(this[impl]["audioTracks"]);
    });
  }

  get videoTracks() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "videoTracks", () => {
      return utils.tryWrapperForImpl(this[impl]["videoTracks"]);
    });
  }

  get textTracks() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.getSameObject(this, "textTracks", () => {
      return utils.tryWrapperForImpl(this[impl]["textTracks"]);
    });
  }
}
Object.defineProperties(HTMLMediaElement.prototype, {
  load: { enumerable: true },
  canPlayType: { enumerable: true },
  play: { enumerable: true },
  pause: { enumerable: true },
  addTextTrack: { enumerable: true },
  src: { enumerable: true },
  currentSrc: { enumerable: true },
  crossOrigin: { enumerable: true },
  networkState: { enumerable: true },
  preload: { enumerable: true },
  buffered: { enumerable: true },
  readyState: { enumerable: true },
  seeking: { enumerable: true },
  currentTime: { enumerable: true },
  duration: { enumerable: true },
  paused: { enumerable: true },
  defaultPlaybackRate: { enumerable: true },
  playbackRate: { enumerable: true },
  played: { enumerable: true },
  seekable: { enumerable: true },
  ended: { enumerable: true },
  autoplay: { enumerable: true },
  loop: { enumerable: true },
  controls: { enumerable: true },
  volume: { enumerable: true },
  muted: { enumerable: true },
  defaultMuted: { enumerable: true },
  audioTracks: { enumerable: true },
  videoTracks: { enumerable: true },
  textTracks: { enumerable: true },
  [Symbol.toStringTag]: { value: "HTMLMediaElement", configurable: true },
  NETWORK_EMPTY: { value: 0, enumerable: true },
  NETWORK_IDLE: { value: 1, enumerable: true },
  NETWORK_LOADING: { value: 2, enumerable: true },
  NETWORK_NO_SOURCE: { value: 3, enumerable: true },
  HAVE_NOTHING: { value: 0, enumerable: true },
  HAVE_METADATA: { value: 1, enumerable: true },
  HAVE_CURRENT_DATA: { value: 2, enumerable: true },
  HAVE_FUTURE_DATA: { value: 3, enumerable: true },
  HAVE_ENOUGH_DATA: { value: 4, enumerable: true }
});
Object.defineProperties(HTMLMediaElement, {
  NETWORK_EMPTY: { value: 0, enumerable: true },
  NETWORK_IDLE: { value: 1, enumerable: true },
  NETWORK_LOADING: { value: 2, enumerable: true },
  NETWORK_NO_SOURCE: { value: 3, enumerable: true },
  HAVE_NOTHING: { value: 0, enumerable: true },
  HAVE_METADATA: { value: 1, enumerable: true },
  HAVE_CURRENT_DATA: { value: 2, enumerable: true },
  HAVE_FUTURE_DATA: { value: 3, enumerable: true },
  HAVE_ENOUGH_DATA: { value: 4, enumerable: true }
});
const iface = {
  // When an interface-module that implements this interface as a mixin is loaded, it will append its own `.is()`
  // method into this array. It allows objects that directly implements *those* interfaces to be recognized as
  // implementing this mixin interface.
  _mixedIntoPredicates: [],
  is(obj) {
    if (obj) {
      if (utils.hasOwn(obj, impl) && obj[impl] instanceof Impl.implementation) {
        return true;
      }
      for (const isMixedInto of module.exports._mixedIntoPredicates) {
        if (isMixedInto(obj)) {
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
      for (const isMixedInto of module.exports._mixedIntoPredicates) {
        if (isMixedInto(wrapper)) {
          return true;
        }
      }
    }
    return false;
  },
  convert(obj, { context = "The provided value" } = {}) {
    if (module.exports.is(obj)) {
      return utils.implForWrapper(obj);
    }
    throw new TypeError(`${context} is not of type 'HTMLMediaElement'.`);
  },

  create(constructorArgs, privateData) {
    let obj = Object.create(HTMLMediaElement.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLMediaElement.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    HTMLElement._internalSetup(obj);
  },
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};

    privateData.wrapper = obj;

    this._internalSetup(obj);
    Object.defineProperty(obj, impl, {
      value: new Impl.implementation(constructorArgs, privateData),
      configurable: true
    });

    obj[impl][utils.wrapperSymbol] = obj;
    if (Impl.init) {
      Impl.init(obj[impl], privateData);
    }
    return obj;
  },
  interface: HTMLMediaElement,
  expose: {
    Window: { HTMLMediaElement }
  }
}; // iface
module.exports = iface;

const Impl = require("../nodes/HTMLMediaElement-impl.js");
