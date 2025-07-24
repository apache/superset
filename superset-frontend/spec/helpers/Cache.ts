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
export const caches: Record<string, Record<string, Response>> = {};

export default class Cache {
  cache: Record<string, Response>;

  constructor(key: string) {
    caches[key] = caches[key] || {};
    this.cache = caches[key];
  }

  match(url: string): Promise<Response | undefined> {
    return new Promise(resolve => resolve(this.cache[url]));
  }

  delete(url: string): Promise<boolean> {
    delete this.cache[url];
    return new Promise(resolve => resolve(true));
  }

  put(url: string, response: Response): Promise<void> {
    this.cache[url] = response;
    return Promise.resolve();
  }
}
