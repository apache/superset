"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const EventTarget = require("./EventTarget.js");
const impl = utils.implSymbol;


module.exports = {
  createInterface: function (defaultPrivateData) {
    defaultPrivateData = defaultPrivateData === undefined ? {} : defaultPrivateData;

function FileReader() {
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }

  iface.setup(this, args);
}
FileReader.prototype = Object.create(EventTarget.interface.prototype);
FileReader.prototype.constructor = FileReader;


FileReader.prototype.readAsArrayBuffer = function readAsArrayBuffer(blob) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to execute 'readAsArrayBuffer' on 'FileReader': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 1; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return this[impl].readAsArrayBuffer.apply(this[impl], args);
};

FileReader.prototype.readAsText = function readAsText(blob) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to execute 'readAsText' on 'FileReader': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 2; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  if (args[1] !== undefined) {
  args[1] = conversions["DOMString"](args[1]);
  }
  return this[impl].readAsText.apply(this[impl], args);
};

FileReader.prototype.readAsDataURL = function readAsDataURL(blob) {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  if (arguments.length < 1) {
    throw new TypeError("Failed to execute 'readAsDataURL' on 'FileReader': 1 argument required, but only " + arguments.length + " present.");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 1; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return this[impl].readAsDataURL.apply(this[impl], args);
};

FileReader.prototype.abort = function abort() {
  if (!this || !module.exports.is(this)) {
    throw new TypeError("Illegal invocation");
  }
  const args = [];
  for (let i = 0; i < arguments.length && i < 0; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  return this[impl].abort.apply(this[impl], args);
};

FileReader.prototype.toString = function () {
  if (this === FileReader.prototype) {
    return "[object FileReaderPrototype]";
  }
  return EventTarget.interface.prototype.toString.call(this);
};
Object.defineProperty(FileReader, "EMPTY", {
  value: 0,
  enumerable: true
});
Object.defineProperty(FileReader.prototype, "EMPTY", {
  value: 0,
  enumerable: true
});

Object.defineProperty(FileReader, "LOADING", {
  value: 1,
  enumerable: true
});
Object.defineProperty(FileReader.prototype, "LOADING", {
  value: 1,
  enumerable: true
});

Object.defineProperty(FileReader, "DONE", {
  value: 2,
  enumerable: true
});
Object.defineProperty(FileReader.prototype, "DONE", {
  value: 2,
  enumerable: true
});

Object.defineProperty(FileReader.prototype, "readyState", {
  get() {
    return this[impl].readyState;
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(FileReader.prototype, "result", {
  get() {
    return utils.tryWrapperForImpl(this[impl].result);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(FileReader.prototype, "error", {
  get() {
    return utils.tryWrapperForImpl(this[impl].error);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(FileReader.prototype, "onloadstart", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onloadstart);
  },
  set(V) {
    this[impl].onloadstart = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(FileReader.prototype, "onprogress", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onprogress);
  },
  set(V) {
    this[impl].onprogress = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(FileReader.prototype, "onload", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onload);
  },
  set(V) {
    this[impl].onload = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(FileReader.prototype, "onabort", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onabort);
  },
  set(V) {
    this[impl].onabort = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(FileReader.prototype, "onerror", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onerror);
  },
  set(V) {
    this[impl].onerror = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});

Object.defineProperty(FileReader.prototype, "onloadend", {
  get() {
    return utils.tryWrapperForImpl(this[impl].onloadend);
  },
  set(V) {
    this[impl].onloadend = utils.tryImplForWrapper(V);
  },
  enumerable: true,
  configurable: true
});


const iface = {
  create(constructorArgs, privateData) {
    let obj = Object.create(FileReader.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(FileReader.prototype);
    this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    EventTarget._internalSetup(obj);

  },
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};
    for (var prop in defaultPrivateData) {
      if (!(prop in privateData)) {
        privateData[prop] = defaultPrivateData[prop];
      }
    }
    privateData.wrapper = obj;

    this._internalSetup(obj);

    obj[impl] = new Impl.implementation(constructorArgs, privateData);
    obj[impl][utils.wrapperSymbol] = obj;
  },
  interface: FileReader,
  expose: {
    Window: { FileReader: FileReader },
    Worker: { FileReader: FileReader }
  }
};
return iface;
  },
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
};

const Impl = require("../file-api/FileReader-impl.js");
