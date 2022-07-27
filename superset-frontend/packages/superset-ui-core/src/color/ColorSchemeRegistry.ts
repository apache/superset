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

import { RegistryWithDefaultKey, OverwritePolicy } from '../models';

export default class ColorSchemeRegistry<T> extends RegistryWithDefaultKey<T> {
  constructor() {
    super({
      name: 'ColorScheme',
      overwritePolicy: OverwritePolicy.WARN,
      setFirstItemAsDefault: true,
    });
  }

  get(key?: string, strict = false) {
    const target = super.get(key) as T | undefined;

    // fallsback to default scheme if any
    if (!strict && !target) {
      const defaultKey = super.getDefaultKey();
      if (defaultKey) {
        return super.get(defaultKey) as T | undefined;
      }
    }
    return target;
  }
}
