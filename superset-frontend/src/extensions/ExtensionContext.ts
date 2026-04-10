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
import type {
  extensions as extensionsApi,
  common,
} from '@apache-superset/core';
import {
  createBrowserStorage,
  createEphemeralState,
  createPersistentState,
} from 'src/core/storage';

type ExtensionContextType = extensionsApi.ExtensionContext;
type Extension = common.Extension;

/**
 * Extension context with lazy-initialized services bound to the extension ID.
 */
class ExtensionContext implements ExtensionContextType {
  readonly extension: Extension;

  private _storage?: ExtensionContextType['storage'];

  constructor(extension: Extension) {
    this.extension = extension;
  }

  get storage(): ExtensionContextType['storage'] {
    if (!this._storage) {
      const { id } = this.extension;
      this._storage = {
        local: createBrowserStorage(localStorage, id),
        session: createBrowserStorage(sessionStorage, id),
        ephemeral: createEphemeralState(id),
        persistent: createPersistentState(id),
      };
    }
    return this._storage;
  }
}

/**
 * Create an extension context.
 */
export function createExtensionContext(
  extension: Extension,
): ExtensionContextType {
  return new ExtensionContext(extension);
}

/**
 * Create a bound getContext function for an extension.
 */
export function createBoundGetContext(
  ctx: ExtensionContextType,
): typeof extensionsApi.getContext {
  return () => ctx;
}
