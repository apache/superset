import Translator from './Translator';

let singleton;

function configure(config) {
  singleton = new Translator(config);
  return singleton;
};

function getInstance() {
  if (!singleton) {
    throw new Error('You must call configure(...) before calling other methods');
  }
  return singleton;
}

function t(...args) {
  return getInstance().translate(...args);
}

export { configure, t };
