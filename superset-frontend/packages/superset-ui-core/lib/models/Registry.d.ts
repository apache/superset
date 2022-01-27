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
export declare enum OverwritePolicy {
    ALLOW = "ALLOW",
    PROHIBIT = "PROHIBIT",
    WARN = "WARN"
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
declare type InclusiveLoaderResult<V> = V | Promise<V>;
export declare type RegistryValue<V, W extends InclusiveLoaderResult<V>> = V | W | undefined;
export declare type RegistryEntry<V, W extends InclusiveLoaderResult<V>> = {
    key: string;
    value: RegistryValue<V, W>;
};
/**
 * A listener is called whenever a registry's entries change.
 * Keys indicates which entries been affected.
 */
export declare type Listener = (keys: string[]) => void;
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
 * Set W=V when does not support asynchronous loader.
 * By default W is set to V | Promise<V> to support
 * both synchronous and asynchronous loaders.
 */
export default class Registry<V, W extends InclusiveLoaderResult<V> = InclusiveLoaderResult<V>> {
    name: string;
    overwritePolicy: OverwritePolicy;
    items: {
        [key: string]: ItemWithValue<V> | ItemWithLoader<W>;
    };
    promises: {
        [key: string]: Promise<V>;
    };
    listeners: Set<Listener>;
    constructor(config?: RegistryConfig);
    clear(): this;
    has(key: string): boolean;
    registerValue(key: string, value: V): this;
    registerLoader(key: string, loader: () => W): this;
    get(key: string): V | W | undefined;
    getAsPromise(key: string): Promise<V>;
    getMap(): {
        [key: string]: RegistryValue<V, W>;
    };
    getMapAsPromise(): Promise<{
        [key: string]: V;
    }>;
    keys(): string[];
    values(): RegistryValue<V, W>[];
    valuesAsPromise(): Promise<V[]>;
    entries(): RegistryEntry<V, W>[];
    entriesAsPromise(): Promise<{
        key: string;
        value: V;
    }[]>;
    remove(key: string): this;
    addListener(listener: Listener): void;
    removeListener(listener: Listener): void;
    private notifyListeners;
}
export {};
//# sourceMappingURL=Registry.d.ts.map