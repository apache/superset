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
 * @fileoverview Host implementation of the `editors` contribution type.
 *
 * Extensions register via the public `editors.registerEditor()` and the host
 * resolves the appropriate provider per language, falling back to the built-in
 * AceEditorProvider when no extension is registered.
 *
 * The public namespace (`editors`) is exposed to extensions on `window.superset`.
 * `EditorHost` is the host-internal component for rendering editors and is NOT
 * part of the public `@apache-superset/core` API.
 */

import { useSyncExternalStore } from 'react';
import { editors as editorsApi } from '@apache-superset/core';
import EditorProviders from './EditorProviders';

export type { EditorHostProps } from './EditorHost';
export { default as EditorHost } from './EditorHost';
export { default as AceEditorProvider } from './AceEditorProvider';

const provider = EditorProviders.getInstance();

export const useEditor = (language: editorsApi.EditorLanguage) =>
  useSyncExternalStore(
    provider.subscribe,
    () => provider.getProvider(language),
    () => undefined,
  );

export const editors: typeof editorsApi = {
  registerEditor: provider.registerProvider.bind(provider),
  getEditor: provider.getProvider.bind(provider),
  hasEditor: provider.hasProvider.bind(provider),
  getAllEditors: provider.getAllProviders.bind(provider),
  onDidRegisterEditor: provider.onDidRegister.bind(provider),
  onDidUnregisterEditor: provider.onDidUnregister.bind(provider),
};
