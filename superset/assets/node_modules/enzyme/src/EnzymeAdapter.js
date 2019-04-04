function unimplementedError(methodName, classname) {
  return new Error(`${methodName} is a required method of ${classname}, but was not implemented.`);
}

class EnzymeAdapter {
  constructor() {
    this.options = {};
  }

  // Provided a bag of options, return an `EnzymeRenderer`. Some options can be implementation
  // specific, like `attach` etc. for React, but not part of this interface explicitly.
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  createRenderer(options) {
    throw unimplementedError('createRenderer', 'EnzymeAdapter');
  }

  // converts an RSTNode to the corresponding JSX Pragma Element. This will be needed
  // in order to implement the `Wrapper.mount()` and `Wrapper.shallow()` methods, but should
  // be pretty straightforward for people to implement.
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  nodeToElement(node) {
    throw unimplementedError('nodeToElement', 'EnzymeAdapter');
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  isValidElement(element) {
    throw unimplementedError('isValidElement', 'EnzymeAdapter');
  }

  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  createElement(type, props, ...children) {
    throw unimplementedError('createElement', 'EnzymeAdapter');
  }

  // eslint-disable-next-line class-methods-use-this
  invokeSetStateCallback(instance, callback) {
    callback.call(instance);
  }
}

EnzymeAdapter.MODES = {
  STRING: 'string',
  MOUNT: 'mount',
  SHALLOW: 'shallow',
};

module.exports = EnzymeAdapter;
