export default function makeSingleton(BaseClass) {
  let singleton;

  function getInstance() {
    if (!singleton) {
      singleton = new BaseClass();
    }
    return singleton;
  }

  const staticFunctions = Object.getOwnPropertyNames(BaseClass.prototype)
    .filter(fn => fn !== 'constructor')
    .reduce((all, fn) => {
      console.log('fn', fn);
      const functions = all;
      functions[fn] = function (...args) {
        return getInstance()[fn](...args);
      };
      return functions;
    }, { getInstance });
  return staticFunctions;
}
