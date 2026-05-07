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

class LRUCache<T> {
  private cache: Map<string, T>;

  readonly capacity: number;

  constructor(capacity: number) {
    if (capacity < 1) {
      throw new Error('The capacity in LRU must be greater than 0.');
    }
    this.capacity = capacity;
    this.cache = new Map<string, T>();
  }

  public has(key: string): boolean {
    return this.cache.has(key);
  }

  public get(key: string): T | undefined {
    // Prevent runtime errors
    if (typeof key !== 'string') {
      throw new TypeError('The LRUCache key must be string.');
    }

    if (this.cache.has(key)) {
      const tmp = this.cache.get(key) as T;
      this.cache.delete(key);
      this.cache.set(key, tmp);
      return tmp;
    }
    return undefined;
  }

  public set(key: string, value: T) {
    // Prevent runtime errors
    if (typeof key !== 'string') {
      throw new TypeError('The LRUCache key must be string.');
    }
    if (this.cache.size >= this.capacity) {
      this.cache.delete(this.cache.keys().next().value);
    }
    this.cache.set(key, value);
  }

  public clear() {
    this.cache.clear();
  }

  public get size() {
    return this.cache.size;
  }

  public values(): T[] {
    return [...this.cache.values()];
  }
}

export function lruCache<T>(capacity = 100) {
  return new LRUCache<T>(capacity);
}
