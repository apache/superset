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
 * @fileoverview Implementation of the editors API for Superset.
 *
 * This module provides the runtime implementation of the editor registration
 * and resolution functions declared in the API types.
 */

import type { contributions } from '@apache-superset/core';
import { editors as editorsApi } from '@apache-superset/core';
import ExtensionsManager from 'src/extensions/ExtensionsManager';
import { Disposable } from '../models';
import EditorProviders from './EditorProviders';

type EditorLanguage = contributions.EditorLanguage;
type EditorProvider = editorsApi.EditorProvider;
type EditorComponent = editorsApi.EditorComponent;
type EditorProviderRegisteredEvent = editorsApi.EditorProviderRegisteredEvent;
type EditorProviderUnregisteredEvent =
  editorsApi.EditorProviderUnregisteredEvent;

/**
 * Register an editor provider for specific languages.
 * The contribution metadata is resolved from the extension manifest by ID.
 *
 * @param id The editor contribution ID declared in extension.json
 * @param component The React component implementing EditorProps
 * @returns A Disposable to unregister the provider
 */
export const registerEditorProvider = (
  id: string,
  component: EditorComponent,
): Disposable => {
  const manager = ExtensionsManager.getInstance();
  const contribution = manager.getEditorContributions().find(c => c.id === id);

  if (!contribution) {
    // eslint-disable-next-line no-console
    console.warn(
      `No editor contribution found in extension.json for id "${id}". ` +
        'Ensure the editor is declared in the contributions.editors array.',
    );
    return new Disposable(() => {});
  }

  const providers = EditorProviders.getInstance();
  return providers.registerProvider(contribution, component);
};

/**
 * Get the editor provider for a specific language.
 * Returns the extension's editor if registered, otherwise undefined.
 *
 * @param language The language to get an editor for
 * @returns The editor provider or undefined if no extension provides one
 */
export const getEditorProvider = (
  language: EditorLanguage,
): EditorProvider | undefined => {
  const manager = EditorProviders.getInstance();
  return manager.getProvider(language);
};

/**
 * Check if an extension has registered an editor for a language.
 *
 * @param language The language to check
 * @returns True if an extension provides an editor for this language
 */
export const hasEditorProvider = (language: EditorLanguage): boolean => {
  const manager = EditorProviders.getInstance();
  return manager.hasProvider(language);
};

/**
 * Get all registered editor providers.
 *
 * @returns Array of all registered editor providers
 */
export const getAllEditorProviders = (): EditorProvider[] => {
  const manager = EditorProviders.getInstance();
  return manager.getAllProviders();
};

/**
 * Event fired when an editor provider is registered.
 * Subscribe to this event to react when extensions register new editors.
 */
export const onDidRegisterEditorProvider = (
  listener: (e: EditorProviderRegisteredEvent) => void,
): Disposable => {
  const manager = EditorProviders.getInstance();
  return manager.onDidRegister(listener);
};

/**
 * Event fired when an editor provider is unregistered.
 * Subscribe to this event to react when extensions unregister editors.
 */
export const onDidUnregisterEditorProvider = (
  listener: (e: EditorProviderUnregisteredEvent) => void,
): Disposable => {
  const manager = EditorProviders.getInstance();
  return manager.onDidUnregister(listener);
};

/**
 * Editors API object for use in the extension system.
 */
export const editors: typeof editorsApi = {
  registerEditorProvider,
  getEditorProvider,
  hasEditorProvider,
  getAllEditorProviders,
  onDidRegisterEditorProvider,
  onDidUnregisterEditorProvider,
};

export { EditorProviders };

// Component exports
export { default as EditorHost } from './EditorHost';
export type { EditorHostProps } from './EditorHost';
export { default as AceEditorProvider } from './AceEditorProvider';
