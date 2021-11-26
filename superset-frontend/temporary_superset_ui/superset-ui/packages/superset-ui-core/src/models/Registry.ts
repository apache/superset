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
  ALLOW = 'ALLOW',
  PROHIBIT = 'PROHIBIT',
  WARN = 'WARN',
}

interface ItemWithValue<T> {
  value: T;
}

interface ItemWithLoader<T> {
  loader: () => T;
}

export interface RegistryConfig {
  name?: string;
  overwritePolicy?: OverwritePolicy;
}

/**
 * Registry class
 *
 * Can use generic to specify type of item in the registry
 * @type V Type of value
 * @type W Type of value returned from loader function when using registerLoader().
 * W can be either V, Promise<V> or V | Promise<V>
 * Set W=V when does not support asynchronous loader.
 * By default W is set to V | Promise<V> to support
 * both synchronous and asynchronous loaders.
 */
export default class Registry<V, W extends V | Promise<V> = V | Promise<V>> {
  name: string;

  overwritePolicy: OverwritePolicy;

  items: {
    [key: string]: ItemWithValue<V> | ItemWithLoader<W>;
  };

  promises: {
    [key: string]: Promise<V>;
  };

  constructor(config: RegistryConfig = {}) {
    const { name = '', overwritePolicy = OverwritePolicy.ALLOW } = config;
    this.name = name;
    this.overwritePolicy = overwritePolicy;
    this.items = {};
    this.promises = {};
  }

  clear() {
    this.items = {};
    this.promises = {};

    return this;
  }

  has(key: string) {
    const item = this.items[key];

    return item !== null && item !== undefined;
  }

  registerValue(key: string, value: V) {
    const item = this.items[key];
    const willOverwrite =
      this.has(key) && (('value' in item && item.value !== value) || 'loader' in item);
    if (willOverwrite) {
      if (this.overwritePolicy === OverwritePolicy.WARN) {
        // eslint-disable-next-line no-console
        console.warn(`Item with key "${key}" already exists. You are assigning a new value.`);
      } else if (this.overwritePolicy === OverwritePolicy.PROHIBIT) {
        throw new Error(`Item with key "${key}" already exists. Cannot overwrite.`);
      }
    }
    if (!item || willOverwrite) {
      this.items[key] = { value };
      delete this.promises[key];
    }

    return this;
  }

  registerLoader(key: string, loader: () => W) {
    const item = this.items[key];
    const willOverwrite =
      this.has(key) && (('loader' in item && item.loader !== loader) || 'value' in item);
    if (willOverwrite) {
      if (this.overwritePolicy === OverwritePolicy.WARN) {
        // eslint-disable-next-line no-console
        console.warn(`Item with key "${key}" already exists. You are assigning a new value.`);
      } else if (this.overwritePolicy === OverwritePolicy.PROHIBIT) {
        throw new Error(`Item with key "${key}" already exists. Cannot overwrite.`);
      }
    }
    if (!item || willOverwrite) {
      this.items[key] = { loader };
      delete this.promises[key];
    }

    return this;
  }

  get(key: string): V | W | undefined {
    const item = this.items[key];
    if (item !== undefined) {
      if ('loader' in item) {
        return item.loader && item.loader();
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

    return Promise.reject<V>(new Error(`Item with key "${key}" is not registered.`));
  }

  getMap() {
    return this.keys().reduce<{
      [key: string]: V | W | undefined;
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

  values(): (V | W | undefined)[] {
    return this.keys().map(key => this.get(key));
  }

  valuesAsPromise(): Promise<V[]> {
    return Promise.all(this.keys().map(key => this.getAsPromise(key)));
  }

  entries(): { key: string; value: V | W | undefined }[] {
    return this.keys().map(key => ({
      key,
      value: this.get(key),
    }));
  }

  entriesAsPromise(): Promise<{ key: string; value: V }[]> {
    const keys = this.keys();

    return Promise.all(keys.map(key => this.getAsPromise(key))).then(values =>
      values.map((value, i) => ({
        key: keys[i],
        value,
      })),
    );
  }

  remove(key: string) {
    delete this.items[key];
    delete this.promises[key];

    return this;
  }
}
