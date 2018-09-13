import Plugin from '../../platform/Plugin';
import * as ChartRegistry from '../registries/ChartRegistry';

const IDENTITY = x => x;

export default class ChartPlugin extends Plugin {
  constructor({
    key,
    metadata,

    // use buildQuery for immediate value
    buildQuery = IDENTITY,
    // use loadBuildQuery for dynamic import (lazy-loading)
    loadBuildQuery,

    // use transformProps for immediate value
    transformProps = IDENTITY,
    // use loadTransformProps for dynamic import (lazy-loading)
    loadTransformProps,

    // use Component for immediate value
    Component,
    // use loadComponent for dynamic import (lazy-loading)
    loadComponent,
  } = {}) {
    super(key);
    this.metadata = metadata;
    this.internal = {};

    this.internal.loadBuildQuery = loadBuildQuery || (() => buildQuery);
    this.internal.loadTransformProps = loadTransformProps || (() => transformProps);

    if (loadComponent) {
      this.internal.loadComponent = loadComponent;
    } else if (Component) {
      this.internal.Component = () => Component;
    } else {
      throw new Error('Component or loadComponent is required');
    }

    this.promises = {};
  }

  getMetadata() {
    return this.metadata;
  }

  loadBuildQuery() {
    if (!this.promises.buildQuery) {
      this.promises.buildQuery = Promise.resolve(this.internal.loadBuildQuery());
    }
    return this.promises.buildQuery;
  }

  loadTransformProps() {
    if (!this.promises.transformProps) {
      this.promises.transformProps = Promise.resolve(this.internal.loadTransformProps());
    }
    return this.promises.transformProps;
  }

  loadComponent() {
    if (!this.promises.component) {
      this.promises.component = Promise.resolve(this.internal.loadComponent());
    }
    return this.promises.component;
  }

  install(key = this.key) {
    super.setInstalledKey(key);
    ChartRegistry.getInstance().add(key, this);
  }
}
