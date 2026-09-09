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
  common,
  extensions as extensionsApi,
} from '@apache-superset/core';
import {
  addDangerToast,
  addInfoToast,
  addWarningToast,
} from 'src/components/MessageToasts/actions';
import { store } from 'src/views/store';
import {
  createBrowserStorage,
  createEphemeralState,
  createPersistentState,
} from 'src/core/storage';

type Extension = common.Extension;
type ExtensionContextType = extensionsApi.ExtensionContext;

/**
 * Extension context with lazy-initialized services bound to the extension ID.
 */
class ExtensionContext implements ExtensionContextType {
  readonly extension: Extension;

  private _storage?: ExtensionContextType['storage'];

  private _window?: ExtensionContextType['window'];

  constructor(extension: Extension) {
    this.extension = extension;
  }

  get window(): ExtensionContextType['window'] {
    if (!this._window) {
      // Dispatched against the app-level `store` singleton directly, not
      // via a `useDispatch()` hook, since this surface must also work from
      // non-component extension code (e.g. a registered command's
      // callback), not just from within a React render.
      this._window = {
        showInformationMessage: (message: string) => {
          store.dispatch(addInfoToast(message));
        },
        showWarningMessage: (message: string) => {
          store.dispatch(addWarningToast(message));
        },
        showErrorMessage: (message: string) => {
          store.dispatch(addDangerToast(message));
        },
      };
    }
    return this._window!;
  }

  get storage(): ExtensionContextType['storage'] {
    if (!this._storage) {
      const { id } = this.extension;
      // `local`/`session` are defined as lazy accessors, not eagerly
      // constructed values: they read the global `localStorage`/
      // `sessionStorage` bindings, which can throw in environments where
      // Web Storage is unavailable or blocked (e.g. some sandboxed
      // iframes). Deferring that access to per-tier property access means
      // a blocked browser storage API only breaks `ctx.storage.local`/
      // `.session` for extensions that actually use them, rather than
      // preventing access to the server-backed `ephemeral`/`persistent`
      // tiers as well.
      this._storage = {
        get local() {
          return createBrowserStorage(localStorage, id);
        },
        get session() {
          return createBrowserStorage(sessionStorage, id);
        },
        ephemeral: createEphemeralState(id),
        persistent: createPersistentState(id),
      };
    }
    return this._storage!;
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
