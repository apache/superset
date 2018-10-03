import Registry from './Registry';

export default class LoaderRegistry extends Registry {
  register(key, value) {
    return super.register(key, () => value);
  }

  registerLoader(key, loader) {
    return super.register(key, loader);
  }

  load(key) {
    return super.getAsPromise(key)
      .then(loader => loader());
  }
}
