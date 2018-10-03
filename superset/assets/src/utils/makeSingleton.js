export default function makeSingleton(BaseClass) {
  let singleton;

  return function getInstance() {
    if (!singleton) {
      singleton = new BaseClass();
    }
    return singleton;
  };
}

export function surfaceStaticFunctions(getInstance, functionNames) {
  const staticFunctions = functionNames
    .reduce((all, fn) => {
      const functions = all;
      functions[fn] = function (...args) {
        return getInstance()[fn](...args);
      };
      return functions;
    }, { getInstance });
  return staticFunctions;
}
