"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const impl = utils.implSymbol;

function GlobalEventHandlers() {
  throw new TypeError("Illegal constructor");
}


GlobalEventHandlers.prototype.toString = function () {
  if (this === GlobalEventHandlers.prototype) {
    return "[object GlobalEventHandlersPrototype]";
  }
  return this[impl].toString();
};
Object.defineProperty(GlobalEventHandlers.prototype, "onabort", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onabort);
  },
  set(V) {
    this[impl].onabort = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onautocomplete", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onautocomplete);
  },
  set(V) {
    this[impl].onautocomplete = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onautocompleteerror", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onautocompleteerror);
  },
  set(V) {
    this[impl].onautocompleteerror = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onblur", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onblur);
  },
  set(V) {
    this[impl].onblur = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "oncancel", {
  get() {
    return utils.tryWrapperForImpl(this[impl].oncancel);
  },
  set(V) {
    this[impl].oncancel = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "oncanplay", {
  get() {
    return utils.tryWrapperForImpl(this[impl].oncanplay);
  },
  set(V) {
    this[impl].oncanplay = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "oncanplaythrough", {
  get() {
    return utils.tryWrapperForImpl(this[impl].oncanplaythrough);
  },
  set(V) {
    this[impl].oncanplaythrough = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onchange", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onchange);
  },
  set(V) {
    this[impl].onchange = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onclick", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onclick);
  },
  set(V) {
    this[impl].onclick = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onclose", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onclose);
  },
  set(V) {
    this[impl].onclose = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "oncontextmenu", {
  get() {
    return utils.tryWrapperForImpl(this[impl].oncontextmenu);
  },
  set(V) {
    this[impl].oncontextmenu = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "oncuechange", {
  get() {
    return utils.tryWrapperForImpl(this[impl].oncuechange);
  },
  set(V) {
    this[impl].oncuechange = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "ondblclick", {
  get() {
    return utils.tryWrapperForImpl(this[impl].ondblclick);
  },
  set(V) {
    this[impl].ondblclick = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "ondrag", {
  get() {
    return utils.tryWrapperForImpl(this[impl].ondrag);
  },
  set(V) {
    this[impl].ondrag = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "ondragend", {
  get() {
    return utils.tryWrapperForImpl(this[impl].ondragend);
  },
  set(V) {
    this[impl].ondragend = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "ondragenter", {
  get() {
    return utils.tryWrapperForImpl(this[impl].ondragenter);
  },
  set(V) {
    this[impl].ondragenter = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "ondragexit", {
  get() {
    return utils.tryWrapperForImpl(this[impl].ondragexit);
  },
  set(V) {
    this[impl].ondragexit = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "ondragleave", {
  get() {
    return utils.tryWrapperForImpl(this[impl].ondragleave);
  },
  set(V) {
    this[impl].ondragleave = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "ondragover", {
  get() {
    return utils.tryWrapperForImpl(this[impl].ondragover);
  },
  set(V) {
    this[impl].ondragover = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "ondragstart", {
  get() {
    return utils.tryWrapperForImpl(this[impl].ondragstart);
  },
  set(V) {
    this[impl].ondragstart = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "ondrop", {
  get() {
    return utils.tryWrapperForImpl(this[impl].ondrop);
  },
  set(V) {
    this[impl].ondrop = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "ondurationchange", {
  get() {
    return utils.tryWrapperForImpl(this[impl].ondurationchange);
  },
  set(V) {
    this[impl].ondurationchange = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onemptied", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onemptied);
  },
  set(V) {
    this[impl].onemptied = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onended", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onended);
  },
  set(V) {
    this[impl].onended = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onerror", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onerror);
  },
  set(V) {
    this[impl].onerror = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onfocus", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onfocus);
  },
  set(V) {
    this[impl].onfocus = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "oninput", {
  get() {
    return utils.tryWrapperForImpl(this[impl].oninput);
  },
  set(V) {
    this[impl].oninput = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "oninvalid", {
  get() {
    return utils.tryWrapperForImpl(this[impl].oninvalid);
  },
  set(V) {
    this[impl].oninvalid = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onkeydown", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onkeydown);
  },
  set(V) {
    this[impl].onkeydown = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onkeypress", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onkeypress);
  },
  set(V) {
    this[impl].onkeypress = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onkeyup", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onkeyup);
  },
  set(V) {
    this[impl].onkeyup = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onload", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onload);
  },
  set(V) {
    this[impl].onload = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onloadeddata", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onloadeddata);
  },
  set(V) {
    this[impl].onloadeddata = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onloadedmetadata", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onloadedmetadata);
  },
  set(V) {
    this[impl].onloadedmetadata = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onloadstart", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onloadstart);
  },
  set(V) {
    this[impl].onloadstart = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onmousedown", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onmousedown);
  },
  set(V) {
    this[impl].onmousedown = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onmouseenter", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onmouseenter);
  },
  set(V) {
    this[impl].onmouseenter = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onmouseleave", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onmouseleave);
  },
  set(V) {
    this[impl].onmouseleave = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onmousemove", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onmousemove);
  },
  set(V) {
    this[impl].onmousemove = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onmouseout", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onmouseout);
  },
  set(V) {
    this[impl].onmouseout = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onmouseover", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onmouseover);
  },
  set(V) {
    this[impl].onmouseover = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onmouseup", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onmouseup);
  },
  set(V) {
    this[impl].onmouseup = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onwheel", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onwheel);
  },
  set(V) {
    this[impl].onwheel = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onpause", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onpause);
  },
  set(V) {
    this[impl].onpause = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onplay", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onplay);
  },
  set(V) {
    this[impl].onplay = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onplaying", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onplaying);
  },
  set(V) {
    this[impl].onplaying = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onprogress", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onprogress);
  },
  set(V) {
    this[impl].onprogress = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onratechange", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onratechange);
  },
  set(V) {
    this[impl].onratechange = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onreset", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onreset);
  },
  set(V) {
    this[impl].onreset = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onresize", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onresize);
  },
  set(V) {
    this[impl].onresize = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onscroll", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onscroll);
  },
  set(V) {
    this[impl].onscroll = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onseeked", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onseeked);
  },
  set(V) {
    this[impl].onseeked = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onseeking", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onseeking);
  },
  set(V) {
    this[impl].onseeking = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onselect", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onselect);
  },
  set(V) {
    this[impl].onselect = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onshow", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onshow);
  },
  set(V) {
    this[impl].onshow = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onsort", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onsort);
  },
  set(V) {
    this[impl].onsort = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onstalled", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onstalled);
  },
  set(V) {
    this[impl].onstalled = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onsubmit", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onsubmit);
  },
  set(V) {
    this[impl].onsubmit = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onsuspend", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onsuspend);
  },
  set(V) {
    this[impl].onsuspend = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "ontimeupdate", {
  get() {
    return utils.tryWrapperForImpl(this[impl].ontimeupdate);
  },
  set(V) {
    this[impl].ontimeupdate = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "ontoggle", {
  get() {
    return utils.tryWrapperForImpl(this[impl].ontoggle);
  },
  set(V) {
    this[impl].ontoggle = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onvolumechange", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onvolumechange);
  },
  set(V) {
    this[impl].onvolumechange = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(GlobalEventHandlers.prototype, "onwaiting", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onwaiting);
  },
  set(V) {
    this[impl].onwaiting = utils.tryImplForWrapper(V);
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
    let obj = Object.create(GlobalEventHandlers.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(GlobalEventHandlers.prototype);
    this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
  },
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};
    privateData.wrapper = obj;

    this._internalSetup(obj);

    obj[impl] = new Impl.implementation(constructorArgs, privateData);
    obj[impl][utils.wrapperSymbol] = obj;
  },
  interface: GlobalEventHandlers,
  expose: {
    
  }
};
module.exports = iface;

const Impl = require("../nodes/GlobalEventHandlers-impl.js");
