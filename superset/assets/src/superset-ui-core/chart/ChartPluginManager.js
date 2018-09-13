class ChartPluginManager {
  constructor() {
    this.items = {};
  }

  add(key, value) {
    this.items[key] = value;
  }

  get(key) {
    return this.items[key];
  }

  getMetadata(key) {
    const plugin = this.get(key);
    return plugin ? plugin.getMetadata() : null;
  }

  getAndLoadOrReject(key, load) {
    const plugin = this.get(key);
    if (plugin) {
      return load(plugin);
    }
    return Promise.reject(`This "${key}" chart is not registered.`);
  }
}

let singleton;

function getInstance() {
  if (!singleton) {
    singleton = new ChartPluginManager();
  }
  return singleton;
}

function getMetadata(key) {
  return getInstance().getMetadata(key);
}

function loadComponent(key) {
  return getInstance().getAndLoadOrReject(
    key,
    plugin => plugin.loadComponent(),
  );
}

function loadTransformProps(key) {
  return getInstance().getAndLoadOrReject(
    key,
    plugin => plugin.loadTransformProps(),
  );
}

export {
  getInstance,
  getMetadata,
  loadComponent,
  loadTransformProps,
};
