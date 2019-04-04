"use strict";

const conversions = require("webidl-conversions");
const utils = require("./utils.js");
const CharacterData = require("./CharacterData.js");
const impl = utils.implSymbol;

function Comment() {
  const args = [];
  for (let i = 0; i < arguments.length && i < 1; ++i) {
    args[i] = utils.tryImplForWrapper(arguments[i]);
  }
  if (args[0] !== undefined) {
  args[0] = conversions["DOMString"](args[0]);
  } else {
    args[0] = "";
  }

  iface.setup(this, args);
}
Comment.prototype = Object.create(CharacterData.interface.prototype);
Comment.prototype.constructor = Comment;


Comment.prototype.toString = function () {
  if (this === Comment.prototype) {
    return "[object CommentPrototype]";
  }
  return CharacterData.interface.prototype.toString.call(this);
};

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
    let obj = Object.create(Comment.prototype);
    this.setup(obj, constructorArgs, privateData);
    return obj;
  },
  createImpl(constructorArgs, privateData) {
    let obj = Object.create(Comment.prototype);
    this.setup(obj, constructorArgs, privateData);
    return utils.implForWrapper(obj);
  },
  _internalSetup(obj) {
    CharacterData._internalSetup(obj);

  },
  setup(obj, constructorArgs, privateData) {
    if (!privateData) privateData = {};
    privateData.wrapper = obj;

    this._internalSetup(obj);

    obj[impl] = new Impl.implementation(constructorArgs, privateData);
    obj[impl][utils.wrapperSymbol] = obj;
  },
  interface: Comment,
  expose: {
    Window: { Comment: Comment }
  }
};
module.exports = iface;

const Impl = require("../nodes/Comment-impl.js");
