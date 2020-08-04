"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const convertBlob = require("./Blob.js").convert;
const impl = utils.implSymbol;
const EventTarget = require("./EventTarget.js");

module.exports = {
  createInterface: function(defaultPrivateData = {}) {
    class FileReader extends EventTarget.interface {
      constructor() {
        return iface.setup(Object.create(new.target.prototype));
      }

      readAsArrayBuffer(blob) {
        if (!this || !module.exports.is(this)) {
          throw new TypeError("Illegal invocation");
        }

        if (arguments.length < 1) {
          throw new TypeError(
            "Failed to execute 'readAsArrayBuffer' on 'FileReader': 1 argument required, but only " +
              arguments.length +
              " present."
          );
        }
        const args = [];
        {
          let curArg = arguments[0];
          curArg = convertBlob(curArg, {
            context: "Failed to execute 'readAsArrayBuffer' on 'FileReader': parameter 1"
          });
          args.push(curArg);
        }
        return this[impl].readAsArrayBuffer(...args);
      }

      readAsBinaryString(blob) {
        if (!this || !module.exports.is(this)) {
          throw new TypeError("Illegal invocation");
        }

        if (arguments.length < 1) {
          throw new TypeError(
            "Failed to execute 'readAsBinaryString' on 'FileReader': 1 argument required, but only " +
              arguments.length +
              " present."
          );
        }
        const args = [];
        {
          let curArg = arguments[0];
          curArg = convertBlob(curArg, {
            context: "Failed to execute 'readAsBinaryString' on 'FileReader': parameter 1"
          });
          args.push(curArg);
        }
        return this[impl].readAsBinaryString(...args);
      }

      readAsText(blob) {
        if (!this || !module.exports.is(this)) {
          throw new TypeError("Illegal invocation");
        }

        if (arguments.length < 1) {
          throw new TypeError(
            "Failed to execute 'readAsText' on 'FileReader': 1 argument required, but only " +
              arguments.length +
              " present."
          );
        }
        const args = [];
        {
          let curArg = arguments[0];
          curArg = convertBlob(curArg, { context: "Failed to execute 'readAsText' on 'FileReader': parameter 1" });
          args.push(curArg);
        }
        {
          let curArg = arguments[1];
          if (curArg !== undefined) {
            curArg = conversions["DOMString"](curArg, {
              context: "Failed to execute 'readAsText' on 'FileReader': parameter 2"
            });
          }
          args.push(curArg);
        }
        return this[impl].readAsText(...args);
      }

      readAsDataURL(blob) {
        if (!this || !module.exports.is(this)) {
          throw new TypeError("Illegal invocation");
        }

        if (arguments.length < 1) {
          throw new TypeError(
            "Failed to execute 'readAsDataURL' on 'FileReader': 1 argument required, but only " +
              arguments.length +
              " present."
          );
        }
        const args = [];
        {
          let curArg = arguments[0];
          curArg = convertBlob(curArg, { context: "Failed to execute 'readAsDataURL' on 'FileReader': parameter 1" });
          args.push(curArg);
        }
        return this[impl].readAsDataURL(...args);
      }

      abort() {
        if (!this || !module.exports.is(this)) {
          throw new TypeError("Illegal invocation");
        }

        return this[impl].abort();
      }

      get readyState() {
        if (!this || !module.exports.is(this)) {
          throw new TypeError("Illegal invocation");
        }

        return this[impl]["readyState"];
      }

      get result() {
        if (!this || !module.exports.is(this)) {
          throw new TypeError("Illegal invocation");
        }

        return utils.tryWrapperForImpl(this[impl]["result"]);
      }

      get error() {
        if (!this || !module.exports.is(this)) {
          throw new TypeError("Illegal invocation");
        }

        return utils.tryWrapperForImpl(this[impl]["error"]);
      }

      get onloadstart() {
        if (!this || !module.exports.is(this)) {
          throw new TypeError("Illegal invocation");
        }

        return utils.tryWrapperForImpl(this[impl]["onloadstart"]);
      }

      set onloadstart(V) {
        if (!this || !module.exports.is(this)) {
          throw new TypeError("Illegal invocation");
        }

        V = utils.tryImplForWrapper(V);

        this[impl]["onloadstart"] = V;
      }

      get onprogress() {
        if (!this || !module.exports.is(this)) {
          throw new TypeError("Illegal invocation");
        }

        return utils.tryWrapperForImpl(this[impl]["onprogress"]);
      }

      set onprogress(V) {
        if (!this || !module.exports.is(this)) {
          throw new TypeError("Illegal invocation");
        }

        V = utils.tryImplForWrapper(V);

        this[impl]["onprogress"] = V;
      }

      get onload() {
        if (!this || !module.exports.is(this)) {
          throw new TypeError("Illegal invocation");
        }

        return utils.tryWrapperForImpl(this[impl]["onload"]);
      }

      set onload(V) {
        if (!this || !module.exports.is(this)) {
          throw new TypeError("Illegal invocation");
        }

        V = utils.tryImplForWrapper(V);

        this[impl]["onload"] = V;
      }

      get onabort() {
        if (!this || !module.exports.is(this)) {
          throw new TypeError("Illegal invocation");
        }

        return utils.tryWrapperForImpl(this[impl]["onabort"]);
      }

      set onabort(V) {
        if (!this || !module.exports.is(this)) {
          throw new TypeError("Illegal invocation");
        }

        V = utils.tryImplForWrapper(V);

        this[impl]["onabort"] = V;
      }

      get onerror() {
        if (!this || !module.exports.is(this)) {
          throw new TypeError("Illegal invocation");
        }

        return utils.tryWrapperForImpl(this[impl]["onerror"]);
      }

      set onerror(V) {
        if (!this || !module.exports.is(this)) {
          throw new TypeError("Illegal invocation");
        }

        V = utils.tryImplForWrapper(V);

        this[impl]["onerror"] = V;
      }

      get onloadend() {
        if (!this || !module.exports.is(this)) {
          throw new TypeError("Illegal invocation");
        }

        return utils.tryWrapperForImpl(this[impl]["onloadend"]);
      }

      set onloadend(V) {
        if (!this || !module.exports.is(this)) {
          throw new TypeError("Illegal invocation");
        }

        V = utils.tryImplForWrapper(V);

        this[impl]["onloadend"] = V;
      }
    }
    Object.defineProperties(FileReader.prototype, {
      readAsArrayBuffer: { enumerable: true },
      readAsBinaryString: { enumerable: true },
      readAsText: { enumerable: true },
      readAsDataURL: { enumerable: true },
      abort: { enumerable: true },
      readyState: { enumerable: true },
      result: { enumerable: true },
      error: { enumerable: true },
      onloadstart: { enumerable: true },
      onprogress: { enumerable: true },
      onload: { enumerable: true },
      onabort: { enumerable: true },
      onerror: { enumerable: true },
      onloadend: { enumerable: true },
      [Symbol.toStringTag]: { value: "FileReader", configurable: true },
      EMPTY: { value: 0, enumerable: true },
      LOADING: { value: 1, enumerable: true },
      DONE: { value: 2, enumerable: true }
    });
    Object.defineProperties(FileReader, {
      EMPTY: { value: 0, enumerable: true },
      LOADING: { value: 1, enumerable: true },
      DONE: { value: 2, enumerable: true }
    });
    const iface = {
      create(constructorArgs, privateData) {
        let obj = Object.create(FileReader.prototype);
        obj = this.setup(obj, constructorArgs, privateData);
        return obj;
      },
      createImpl(constructorArgs, privateData) {
        let obj = Object.create(FileReader.prototype);
        obj = this.setup(obj, constructorArgs, privateData);
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
      interface: FileReader,
      expose: {
        Window: { FileReader },
        Worker: { FileReader }
      }
    }; // iface
    return iface;
  }, // createInterface

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
    throw new TypeError(`${context} is not of type 'FileReader'.`);
  }
}; // module.exports

const Impl = require("../file-api/FileReader-impl.js");
