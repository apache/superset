/*
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

interface PlainObject {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export default class Plugin {
  config: PlainObject;

  constructor() {
    this.config = {};
  }

  resetConfig() {
    // The child class can set default config
    // by overriding this function.
    this.config = {};

    return this;
  }

  configure(config: PlainObject, replace = false) {
    this.config = replace ? config : { ...this.config, ...config };

    return this;
  }

  register() {
    return this;
  }

  unregister() {
    return this;
  }
}
