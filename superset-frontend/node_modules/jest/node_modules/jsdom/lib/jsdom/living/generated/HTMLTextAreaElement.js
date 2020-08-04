"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");

const convertSelectionMode = require("./SelectionMode.js").convert;
const impl = utils.implSymbol;
const HTMLElement = require("./HTMLElement.js");

class HTMLTextAreaElement extends HTMLElement.interface {
  constructor() {
    throw new TypeError("Illegal constructor");
  }

  checkValidity() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].checkValidity();
  }

  reportValidity() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].reportValidity();
  }

  setCustomValidity(error) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'setCustomValidity' on 'HTMLTextAreaElement': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["DOMString"](curArg, {
        context: "Failed to execute 'setCustomValidity' on 'HTMLTextAreaElement': parameter 1"
      });
      args.push(curArg);
    }
    return this[impl].setCustomValidity(...args);
  }

  select() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].select();
  }

  setRangeText(replacement) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 1) {
      throw new TypeError(
        "Failed to execute 'setRangeText' on 'HTMLTextAreaElement': 1 argument required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    switch (arguments.length) {
      case 1:
        {
          let curArg = arguments[0];
          curArg = conversions["DOMString"](curArg, {
            context: "Failed to execute 'setRangeText' on 'HTMLTextAreaElement': parameter 1"
          });
          args.push(curArg);
        }
        break;
      case 2:
        throw new TypeError(
          "Failed to execute 'setRangeText' on 'HTMLTextAreaElement': only " + arguments.length + " arguments present."
        );
        break;
      case 3:
        {
          let curArg = arguments[0];
          curArg = conversions["DOMString"](curArg, {
            context: "Failed to execute 'setRangeText' on 'HTMLTextAreaElement': parameter 1"
          });
          args.push(curArg);
        }
        {
          let curArg = arguments[1];
          curArg = conversions["unsigned long"](curArg, {
            context: "Failed to execute 'setRangeText' on 'HTMLTextAreaElement': parameter 2"
          });
          args.push(curArg);
        }
        {
          let curArg = arguments[2];
          curArg = conversions["unsigned long"](curArg, {
            context: "Failed to execute 'setRangeText' on 'HTMLTextAreaElement': parameter 3"
          });
          args.push(curArg);
        }
        break;
      default:
        {
          let curArg = arguments[0];
          curArg = conversions["DOMString"](curArg, {
            context: "Failed to execute 'setRangeText' on 'HTMLTextAreaElement': parameter 1"
          });
          args.push(curArg);
        }
        {
          let curArg = arguments[1];
          curArg = conversions["unsigned long"](curArg, {
            context: "Failed to execute 'setRangeText' on 'HTMLTextAreaElement': parameter 2"
          });
          args.push(curArg);
        }
        {
          let curArg = arguments[2];
          curArg = conversions["unsigned long"](curArg, {
            context: "Failed to execute 'setRangeText' on 'HTMLTextAreaElement': parameter 3"
          });
          args.push(curArg);
        }
        {
          let curArg = arguments[3];
          if (curArg !== undefined) {
            curArg = convertSelectionMode(curArg, {
              context: "Failed to execute 'setRangeText' on 'HTMLTextAreaElement': parameter 4"
            });
          } else {
            curArg = "preserve";
          }
          args.push(curArg);
        }
    }
    return this[impl].setRangeText(...args);
  }

  setSelectionRange(start, end) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    if (arguments.length < 2) {
      throw new TypeError(
        "Failed to execute 'setSelectionRange' on 'HTMLTextAreaElement': 2 arguments required, but only " +
          arguments.length +
          " present."
      );
    }
    const args = [];
    {
      let curArg = arguments[0];
      curArg = conversions["unsigned long"](curArg, {
        context: "Failed to execute 'setSelectionRange' on 'HTMLTextAreaElement': parameter 1"
      });
      args.push(curArg);
    }
    {
      let curArg = arguments[1];
      curArg = conversions["unsigned long"](curArg, {
        context: "Failed to execute 'setSelectionRange' on 'HTMLTextAreaElement': parameter 2"
      });
      args.push(curArg);
    }
    {
      let curArg = arguments[2];
      if (curArg !== undefined) {
        curArg = conversions["DOMString"](curArg, {
          context: "Failed to execute 'setSelectionRange' on 'HTMLTextAreaElement': parameter 3"
        });
      }
      args.push(curArg);
    }
    return this[impl].setSelectionRange(...args);
  }

  get autocomplete() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "autocomplete");
    return value === null ? "" : value;
  }

  set autocomplete(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'autocomplete' property on 'HTMLTextAreaElement': The provided value"
    });

    this[impl].setAttributeNS(null, "autocomplete", V);
  }

  get autofocus() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].hasAttributeNS(null, "autofocus");
  }

  set autofocus(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["boolean"](V, {
      context: "Failed to set the 'autofocus' property on 'HTMLTextAreaElement': The provided value"
    });

    if (V) {
      this[impl].setAttributeNS(null, "autofocus", "");
    } else {
      this[impl].removeAttributeNS(null, "autofocus");
    }
  }

  get cols() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["cols"];
  }

  set cols(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["unsigned long"](V, {
      context: "Failed to set the 'cols' property on 'HTMLTextAreaElement': The provided value"
    });

    this[impl]["cols"] = V;
  }

  get dirName() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "dirname");
    return value === null ? "" : value;
  }

  set dirName(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'dirName' property on 'HTMLTextAreaElement': The provided value"
    });

    this[impl].setAttributeNS(null, "dirname", V);
  }

  get disabled() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].hasAttributeNS(null, "disabled");
  }

  set disabled(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["boolean"](V, {
      context: "Failed to set the 'disabled' property on 'HTMLTextAreaElement': The provided value"
    });

    if (V) {
      this[impl].setAttributeNS(null, "disabled", "");
    } else {
      this[impl].removeAttributeNS(null, "disabled");
    }
  }

  get form() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["form"]);
  }

  get inputMode() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "inputmode");
    return value === null ? "" : value;
  }

  set inputMode(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'inputMode' property on 'HTMLTextAreaElement': The provided value"
    });

    this[impl].setAttributeNS(null, "inputmode", V);
  }

  get maxLength() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = parseInt(this[impl].getAttributeNS(null, "maxlength"));
    return isNaN(value) || value < -2147483648 || value > 2147483647 ? 0 : value;
  }

  set maxLength(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["long"](V, {
      context: "Failed to set the 'maxLength' property on 'HTMLTextAreaElement': The provided value"
    });

    this[impl].setAttributeNS(null, "maxlength", String(V));
  }

  get minLength() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = parseInt(this[impl].getAttributeNS(null, "minlength"));
    return isNaN(value) || value < -2147483648 || value > 2147483647 ? 0 : value;
  }

  set minLength(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["long"](V, {
      context: "Failed to set the 'minLength' property on 'HTMLTextAreaElement': The provided value"
    });

    this[impl].setAttributeNS(null, "minlength", String(V));
  }

  get name() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "name");
    return value === null ? "" : value;
  }

  set name(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'name' property on 'HTMLTextAreaElement': The provided value"
    });

    this[impl].setAttributeNS(null, "name", V);
  }

  get placeholder() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "placeholder");
    return value === null ? "" : value;
  }

  set placeholder(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'placeholder' property on 'HTMLTextAreaElement': The provided value"
    });

    this[impl].setAttributeNS(null, "placeholder", V);
  }

  get readOnly() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].hasAttributeNS(null, "readonly");
  }

  set readOnly(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["boolean"](V, {
      context: "Failed to set the 'readOnly' property on 'HTMLTextAreaElement': The provided value"
    });

    if (V) {
      this[impl].setAttributeNS(null, "readonly", "");
    } else {
      this[impl].removeAttributeNS(null, "readonly");
    }
  }

  get required() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl].hasAttributeNS(null, "required");
  }

  set required(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["boolean"](V, {
      context: "Failed to set the 'required' property on 'HTMLTextAreaElement': The provided value"
    });

    if (V) {
      this[impl].setAttributeNS(null, "required", "");
    } else {
      this[impl].removeAttributeNS(null, "required");
    }
  }

  get rows() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["rows"];
  }

  set rows(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["unsigned long"](V, {
      context: "Failed to set the 'rows' property on 'HTMLTextAreaElement': The provided value"
    });

    this[impl]["rows"] = V;
  }

  get wrap() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    const value = this[impl].getAttributeNS(null, "wrap");
    return value === null ? "" : value;
  }

  set wrap(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'wrap' property on 'HTMLTextAreaElement': The provided value"
    });

    this[impl].setAttributeNS(null, "wrap", V);
  }

  get type() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["type"];
  }

  get defaultValue() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["defaultValue"];
  }

  set defaultValue(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'defaultValue' property on 'HTMLTextAreaElement': The provided value"
    });

    this[impl]["defaultValue"] = V;
  }

  get value() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["value"];
  }

  set value(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'value' property on 'HTMLTextAreaElement': The provided value",
      treatNullAsEmptyString: true
    });

    this[impl]["value"] = V;
  }

  get textLength() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["textLength"];
  }

  get willValidate() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["willValidate"];
  }

  get validity() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["validity"]);
  }

  get validationMessage() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["validationMessage"];
  }

  get labels() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return utils.tryWrapperForImpl(this[impl]["labels"]);
  }

  get selectionStart() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["selectionStart"];
  }

  set selectionStart(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["unsigned long"](V, {
      context: "Failed to set the 'selectionStart' property on 'HTMLTextAreaElement': The provided value"
    });

    this[impl]["selectionStart"] = V;
  }

  get selectionEnd() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["selectionEnd"];
  }

  set selectionEnd(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["unsigned long"](V, {
      context: "Failed to set the 'selectionEnd' property on 'HTMLTextAreaElement': The provided value"
    });

    this[impl]["selectionEnd"] = V;
  }

  get selectionDirection() {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    return this[impl]["selectionDirection"];
  }

  set selectionDirection(V) {
    if (!this || !module.exports.is(this)) {
      throw new TypeError("Illegal invocation");
    }

    V = conversions["DOMString"](V, {
      context: "Failed to set the 'selectionDirection' property on 'HTMLTextAreaElement': The provided value"
    });

    this[impl]["selectionDirection"] = V;
  }
}
Object.defineProperties(HTMLTextAreaElement.prototype, {
  checkValidity: { enumerable: true },
  reportValidity: { enumerable: true },
  setCustomValidity: { enumerable: true },
  select: { enumerable: true },
  setRangeText: { enumerable: true },
  setSelectionRange: { enumerable: true },
  autocomplete: { enumerable: true },
  autofocus: { enumerable: true },
  cols: { enumerable: true },
  dirName: { enumerable: true },
  disabled: { enumerable: true },
  form: { enumerable: true },
  inputMode: { enumerable: true },
  maxLength: { enumerable: true },
  minLength: { enumerable: true },
  name: { enumerable: true },
  placeholder: { enumerable: true },
  readOnly: { enumerable: true },
  required: { enumerable: true },
  rows: { enumerable: true },
  wrap: { enumerable: true },
  type: { enumerable: true },
  defaultValue: { enumerable: true },
  value: { enumerable: true },
  textLength: { enumerable: true },
  willValidate: { enumerable: true },
  validity: { enumerable: true },
  validationMessage: { enumerable: true },
  labels: { enumerable: true },
  selectionStart: { enumerable: true },
  selectionEnd: { enumerable: true },
  selectionDirection: { enumerable: true },
  [Symbol.toStringTag]: { value: "HTMLTextAreaElement", configurable: true }
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
    throw new TypeError(`${context} is not of type 'HTMLTextAreaElement'.`);
  },

  create(constructorArgs, privateData) {
    let obj = Object.create(HTMLTextAreaElement.prototype);
    obj = this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(HTMLTextAreaElement.prototype);
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
  interface: HTMLTextAreaElement,
  expose: {
    Window: { HTMLTextAreaElement }
  }
}; // iface
module.exports = iface;

const Impl = require("../nodes/HTMLTextAreaElement-impl.js");
