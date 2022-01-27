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
import Registry from './Registry';
export default class RegistryWithDefaultKey extends Registry {
    initialDefaultKey;
    defaultKey;
    setFirstItemAsDefault;
    constructor(config = {}) {
        super(config);
        const { initialDefaultKey = undefined, setFirstItemAsDefault = false } = config;
        this.initialDefaultKey = initialDefaultKey;
        this.defaultKey = initialDefaultKey;
        this.setFirstItemAsDefault = setFirstItemAsDefault;
    }
    clear() {
        super.clear();
        this.defaultKey = this.initialDefaultKey;
        return this;
    }
    get(key) {
        const targetKey = key ?? this.defaultKey;
        return targetKey ? super.get(targetKey) : undefined;
    }
    registerValue(key, value) {
        super.registerValue(key, value);
        // If there is no default, set as default
        if (this.setFirstItemAsDefault && !this.defaultKey) {
            this.defaultKey = key;
        }
        return this;
    }
    registerLoader(key, loader) {
        super.registerLoader(key, loader);
        // If there is no default, set as default
        if (this.setFirstItemAsDefault && !this.defaultKey) {
            this.defaultKey = key;
        }
        return this;
    }
    getDefaultKey() {
        return this.defaultKey;
    }
    setDefaultKey(key) {
        this.defaultKey = key;
        return this;
    }
    clearDefaultKey() {
        this.defaultKey = undefined;
        return this;
    }
}
//# sourceMappingURL=RegistryWithDefaultKey.js.map