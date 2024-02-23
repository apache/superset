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
 *
 * Listener methods have not been added because there isn't a use case yet.
 */
class TypedRegistry<TYPEMAP extends {}> {
  name = 'TypedRegistry';

  private records: TYPEMAP;

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
  }
}

export default TypedRegistry;
