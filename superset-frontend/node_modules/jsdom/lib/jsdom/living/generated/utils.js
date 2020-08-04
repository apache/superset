"use strict";

module.exports.mixin = function mixin(target, source) {
  const keys = Object.getOwnPropertyNames(source);
  for (let i = 0; i < keys.length; ++i) {
    if (keys[i] in target) {
      continue;
    }

    Object.defineProperty(target, keys[i], Object.getOwnPropertyDescriptor(source, keys[i]));
  }
};

const wrapperSymbol = Symbol("wrapper");
const implSymbol = Symbol("impl");

function wrapperForImpl(impl) {
  return impl ? impl[wrapperSymbol] : null;
};

function implForWrapper(wrapper) {
  return wrapper ? wrapper[implSymbol] : null;
};

function tryWrapperForImpl(impl) {
  const wrapper = wrapperForImpl(impl);
  return wrapper ? wrapper : impl;
};

function tryImplForWrapper(wrapper) {
  const impl = implForWrapper(wrapper);
  return impl ? impl : wrapper;
};

const iterInternalSymbol = Symbol("internal");
const IteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()));

module.exports.wrapperSymbol = wrapperSymbol;
module.exports.implSymbol = implSymbol;
module.exports.wrapperForImpl = wrapperForImpl;
module.exports.implForWrapper = implForWrapper;
module.exports.tryWrapperForImpl = tryWrapperForImpl;
module.exports.tryImplForWrapper = tryImplForWrapper;
module.exports.iterInternalSymbol = iterInternalSymbol;
module.exports.IteratorPrototype = IteratorPrototype;
