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

/**
 * A Registry which serves as a typed key:value store for Superset and for Plugins.
 *
 * Differences from the older Registry class:
 *
 * 1. The keys and values stored in this class are individually typed by TYPEMAP parameter.
 *    In the old Registry, all values are of the same type and keys are not enumerated.
 *    Though you can also use indexed or mapped types in a TYPEMAP.
 *
 * 2. This class does not have a separate async get and set methods or use loaders.
 *    Instead, TYPEMAP should specify async values and loaders explicitly when needed.
 *    The value can be anything! A string, a class, a function, an async function... anything!
 *
 * 3. This class does not implement Policies, that is a separate concern to be handled elsewhere.
 *
 *
 * Removing or altering types in a type map could be a potential breaking change, be careful!
 */
class TypedRegistry<TYPEMAP extends {}> {
  name = 'TypedRegistry';

  private records: TYPEMAP;

  private listeners: Set<() => void> = new Set();

  constructor(initialRecords: TYPEMAP) {
    this.records = initialRecords;
  }

  get<K extends keyof TYPEMAP>(key: K): TYPEMAP[K] {
    // The type construction above means that when you call this function,
    // you get a really specific type back.
    return this.records[key];
  }

  set<K extends keyof TYPEMAP>(key: K, value: TYPEMAP[K]) {
    this.records[key] = value;
    this.listeners.forEach(listener => listener());
  }

  /**
   * Observes registrations, so a reader can re-read after one.
   *
   * Everything that registers into this registry at application startup does
   * so before anything renders, which is why a plain `get` during render was
   * enough for a long time. Extensions are the case that breaks it: they are
   * fetched and evaluated after the application has already mounted, so a
   * component that read this registry during its first render read an empty
   * one and has no reason to look again. Nothing errors -- the registration
   * simply never takes effect, which is the hardest version of this bug to
   * find.
   *
   * @param listener Called after any `set`, with no arguments: the reader
   *                 re-reads the keys it cares about.
   * @returns A function that stops the observation.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export default TypedRegistry;
