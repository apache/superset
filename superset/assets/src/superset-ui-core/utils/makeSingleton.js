export default function makeSingleton(BaseClass) {
  let singleton;

  return function getInstance() {
    if (!singleton) {
      singleton = new BaseClass();
    }
    return singleton;
  };
}
