"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const impl = utils.implSymbol;
const SVGGraphicsElement = require("./SVGGraphicsElement.js");

class SVGSVGElement extends SVGGraphicsElement.interface {
  constructor() {
    throw new TypeError("Illegal constructor");
  }

  createSVGNumber() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl].createSVGNumber());
  }

  getElementById(elementId) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'getElementById' on 'SVGSVGElement': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'getElementById' on 'SVGSVGElement': parameter 1"
      });
      args.push(curArg);
    }
    return utils.tryWrapperForImpl(this[impl].getElementById(...args));
  }

  suspendRedraw(maxWaitMilliseconds) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'suspendRedraw' on 'SVGSVGElement': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["unsigned long"](curArg, {
        context: "Failed to execute 'suspendRedraw' on 'SVGSVGElement': parameter 1"
      });
      args.push(curArg);
    }
    return this[impl].suspendRedraw(...args);
  }

  unsuspendRedraw(suspendHandleID) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'unsuspendRedraw' on 'SVGSVGElement': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["unsigned long"](curArg, {
        context: "Failed to execute 'unsuspendRedraw' on 'SVGSVGElement': parameter 1"
      });
      args.push(curArg);
    }
    return this[impl].unsuspendRedraw(...args);
  }

  unsuspendRedrawAll() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].unsuspendRedrawAll();
  }

  forceRedraw() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].forceRedraw();
  }

  get onafterprint() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onafterprint"]);
  }

  set onafterprint(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onafterprint"] = V;
  }

  get onbeforeprint() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onbeforeprint"]);
  }

  set onbeforeprint(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onbeforeprint"] = V;
  }

  get onbeforeunload() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onbeforeunload"]);
  }

  set onbeforeunload(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onbeforeunload"] = V;
  }

  get onhashchange() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onhashchange"]);
  }

  set onhashchange(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onhashchange"] = V;
  }

  get onlanguagechange() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onlanguagechange"]);
  }

  set onlanguagechange(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onlanguagechange"] = V;
  }

  get onmessage() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onmessage"]);
  }

  set onmessage(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onmessage"] = V;
  }

  get onmessageerror() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onmessageerror"]);
  }

  set onmessageerror(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onmessageerror"] = V;
  }

  get onoffline() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onoffline"]);
  }

  set onoffline(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onoffline"] = V;
  }

  get ononline() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["ononline"]);
  }

  set ononline(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["ononline"] = V;
  }

  get onpagehide() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onpagehide"]);
  }

  set onpagehide(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onpagehide"] = V;
  }

  get onpageshow() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onpageshow"]);
  }

  set onpageshow(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onpageshow"] = V;
  }

  get onpopstate() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onpopstate"]);
  }

  set onpopstate(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onpopstate"] = V;
  }

  get onrejectionhandled() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onrejectionhandled"]);
  }

  set onrejectionhandled(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onrejectionhandled"] = V;
  }

  get onstorage() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onstorage"]);
  }

  set onstorage(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onstorage"] = V;
  }

  get onunhandledrejection() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onunhandledrejection"]);
  }

  set onunhandledrejection(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onunhandledrejection"] = V;
  }

  get onunload() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["onunload"]);
  }

  set onunload(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = utils.tryImplForWrapper(V);

    this[impl]["onunload"] = V;
  }
}
Object.defineProperties(SVGSVGElement.prototype, {
  createSVGNumber: { enumerable: true },
  getElementById: { enumerable: true },
  suspendRedraw: { enumerable: true },
  unsuspendRedraw: { enumerable: true },
  unsuspendRedrawAll: { enumerable: true },
  forceRedraw: { enumerable: true },
  onafterprint: { enumerable: true },
  onbeforeprint: { enumerable: true },
  onbeforeunload: { enumerable: true },
  onhashchange: { enumerable: true },
  onlanguagechange: { enumerable: true },
  onmessage: { enumerable: true },
  onmessageerror: { enumerable: true },
  onoffline: { enumerable: true },
  ononline: { enumerable: true },
  onpagehide: { enumerable: true },
  onpageshow: { enumerable: true },
  onpopstate: { enumerable: true },
  onrejectionhandled: { enumerable: true },
  onstorage: { enumerable: true },
  onunhandledrejection: { enumerable: true },
  onunload: { enumerable: true },
  [Symbol.toStringTag]: { value: "SVGSVGElement", configurable: true }
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
    throw new TypeError(`${context} is not of type 'SVGSVGElement'.`);
  },

  create(constructorArgs, privateData) {
    let obj = Object.create(SVGSVGElement.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(SVGSVGElement.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    SVGGraphicsElement._internalSetup(obj);
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
  interface: SVGSVGElement,
  expose: {
    Window: { SVGSVGElement }
  }
}; // iface
module.exports = iface;

const Impl = require("../nodes/SVGSVGElement-impl.js");
