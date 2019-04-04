// Inspired by https://github.com/popomore/spy
// Attach a spy to the function. The spy has the following methods and fields
//  * restore() - remove spy completely
//  * reset() - reset call count
//  * callCount - number of calls
//  * called - whether spy was called
export function makeSpy(obj, func) {
  let methodName;

  if (!obj && !func) {
    func = function mock() {};
    obj = {};
    methodName = 'spy';
  } else if (typeof obj === 'function' && !func) {
    func = obj;
    obj = {};
    methodName = `${func.name}-spy`;
  } else {
    methodName = func;
    func = obj[methodName];
  }

  return wrapFunction(obj, func, methodName);
}

function wrapFunction(obj, func, methodName) {
  // will not wrap more than once
  if (func.func !== undefined) {
    return func;
  }

  // create a local function
  function spy(...args) {
    spy.callCount++;
    spy.called = true;
    /* eslint-disable no-invalid-this */
    return 'returnValue' in spy ? spy.returnValue : func.apply(this, args);
  }

  // Add functions and members
  Object.assign(spy, {
    reset() {
      spy.callCount = 0;
      spy.called = false;
    },

    restore() {
      obj[methodName] = func;
    },

    returns(returnValue) {
      spy.returnValue = returnValue;
    },

    obj,
    methodName,
    func,
    method: func
  });

  spy.reset();

  // Overwrite the spy on the object
  obj[methodName] = spy;
  return spy;
}
