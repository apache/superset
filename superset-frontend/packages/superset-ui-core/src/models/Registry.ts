/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
export enum OverwritePolicy {
  Allow = 'ALLOW',
  Prohibit = 'PROHIBIT',
  Warn = 'WARN',
}

interface ItemWithValue<T> {
  value: T;
}

interface ItemWithLoader<T> {
  loader: () => T;
}

/**
 * Type of value returned from loader function when using registerLoader()
 */
type InclusiveLoaderResult<V> = V | Promise<V>;

export type RegistryValue<V, W extends InclusiveLoaderResult<V>> =
  | V
  | W
  | undefined;

export type RegistryEntry<V, W extends InclusiveLoaderResult<V>> = {
  key: string;
  value: RegistryValue<V, W>;
};

/**
 * A listener is called whenever a registry's entries change.
 * Keys indicates which entries been affected.
 */
export type Listener = (keys: string[]) => void;

export interface RegistryConfig {
  name?: string;
  overwritePolicy?: OverwritePolicy;
}

/**
 * Registry class
 *
 * !!!!!!!!
 * IF YOU ARE ADDING A NEW REGISTRY TO SUPERSET, CONSIDER USING TypedRegistry
 * !!!!!!!!
 *
 * Can use generic to specify type of item in the registry
 * @type V Type of value
 * @type W Type of value returned from loader function when using registerLoader().
 * Set W=V when does not support asynchronous loader.
 * By default W is set to V | Promise<V> to support
 * both synchronous and asynchronous loaders.
 */
export default class Registry<
  V,
  W extends InclusiveLoaderResult<V> = InclusiveLoaderResult<V>,
> {
  name: string;

  overwritePolicy: OverwritePolicy;

  items: {
    [key: string]: ItemWithValue<V> | ItemWithLoader<W>;
  };

  promises: {
    [key: string]: Promise<V>;
  };

  listeners: Set<Listener>;

  constructor(config: RegistryConfig = {}) {
    const { name = '', overwritePolicy = OverwritePolicy.Allow } = config;
    this.name = name;
    this.overwritePolicy = overwritePolicy;
    this.items = {};
    this.promises = {};
    this.listeners = new Set();
  }

  clear() {
    const keys = this.keys();

    this.items = {};
    this.promises = {};
    this.notifyListeners(keys);

    return this;
  }

  has(key: string) {
    const item = this.items[key];

    return item !== null && item !== undefined;
  }

  registerValue(key: string, value: V) {
    const item = this.items[key];
    const willOverwrite =
      this.has(key) &&
      (('value' in item && item.value !== value) || 'loader' in item);
    if (willOverwrite) {
      if (this.overwritePolicy === OverwritePolicy.Warn) {
        // eslint-disable-next-line no-console
        console.warn(
          `Item with key "${key}" already exists. You are assigning a new value.`,
        );
      } else if (this.overwritePolicy === OverwritePolicy.Prohibit) {
        throw new Error(
          `Item with key "${key}" already exists. Cannot overwrite.`,
        );
      }
    }
    if (!item || willOverwrite) {
      this.items[key] = { value };
      delete this.promises[key];
      this.notifyListeners([key]);
    }

    return this;
  }

  registerLoader(key: string, loader: () => W) {
    const item = this.items[key];
    const willOverwrite =
      this.has(key) &&
      (('loader' in item && item.loader !== loader) || 'value' in item);
    if (willOverwrite) {
      if (this.overwritePolicy === OverwritePolicy.Warn) {
        // eslint-disable-next-line no-console
        console.warn(
          `Item with key "${key}" already exists. You are assigning a new value.`,
        );
      } else if (this.overwritePolicy === OverwritePolicy.Prohibit) {
        throw new Error(
          `Item with key "${key}" already exists. Cannot overwrite.`,
        );
      }
    }
    if (!item || willOverwrite) {
      this.items[key] = { loader };
      delete this.promises[key];
      this.notifyListeners([key]);
    }

    return this;
  }

  get(key: string): V | W | undefined {
    const item = this.items[key];
    if (item !== undefined) {
      if ('loader' in item) {
        return item.loader?.();
      }

      return item.value;
    }

    return undefined;
  }

  getAsPromise(key: string): Promise<V> {
    const promise = this.promises[key];

    if (typeof promise !== 'undefined') {
      return promise;
    }
    const item = this.get(key);
    if (item !== undefined) {
      const newPromise = Promise.resolve(item) as Promise<V>;
      this.promises[key] = newPromise;

      return newPromise;
    }

    return Promise.reject<V>(
      new Error(`Item with key "${key}" is not registered.`),
    );
  }

  getMap() {
    return this.keys().reduce<{
      [key: string]: RegistryValue<V, W>;
    }>((prev, key) => {
      const map = prev;
      map[key] = this.get(key);

      return map;
    }, {});
  }

  getMapAsPromise() {
    const keys = this.keys();

    return Promise.all(keys.map(key => this.getAsPromise(key))).then(values =>
      values.reduce<{
        [key: string]: V;
      }>((prev, value, i) => {
        const map = prev;
        map[keys[i]] = value;

        return map;
      }, {}),
    );
  }

  keys(): string[] {
    return Object.keys(this.items);
  }

  values(): RegistryValue<V, W>[] {
    return this.keys().map(key => this.get(key));
  }

  valuesAsPromise(): Promise<V[]> {
    return Promise.all(this.keys().map(key => this.getAsPromise(key)));
  }

  entries(): RegistryEntry<V, W>[] {
    return this.keys().map(key => ({
      key,
      value: this.get(key),
    }));
  }

  entriesAsPromise(): Promise<{ key: string; value: V }[]> {
    const keys = this.keys();

    return this.valuesAsPromise().then(values =>
      values.map((value, i) => ({
        key: keys[i],
        value,
      })),
    );
  }

  remove(key: string) {
    const isChange = this.has(key);
    delete this.items[key];
    delete this.promises[key];
    if (isChange) {
      this.notifyListeners([key]);
    }

    return this;
  }

  addListener(listener: Listener) {
    this.listeners.add(listener);
  }

  removeListener(listener: Listener) {
    this.listeners.delete(listener);
  }

  private notifyListeners(keys: string[]) {
    this.listeners.forEach(listener => {
      try {
        listener(keys);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Exception thrown from a registry listener:', e);
      }
    });
  }
}
