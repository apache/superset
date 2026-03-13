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

import { editors as editorsApi } from '@apache-superset/core';
import { Disposable } from '../models';
import EditorProviders from './EditorProviders';

type EditorLanguage = editorsApi.EditorLanguage;
type Editor = editorsApi.Editor;
type EditorProvider = editorsApi.EditorProvider;
type EditorComponent = editorsApi.EditorComponent;
type EditorRegisteredEvent = editorsApi.EditorRegisteredEvent;
type EditorUnregisteredEvent = editorsApi.EditorUnregisteredEvent;

/**
 * Register an editor provider as a module-level side effect.
 * Takes the editor descriptor directly rather than looking it up
 * from a manifest by ID.
 *
 * @param editor The editor descriptor.
 * @param component The React component implementing the editor.
 * @returns A Disposable to unregister the provider.
 */
export const registerEditor = (
  editor: Editor,
  component: EditorComponent,
): Disposable => {
  const providers = EditorProviders.getInstance();
  return providers.registerProvider(editor, component);
};

/**
 * Get the editor provider for a specific language.
 * Returns the extension's editor if registered, otherwise undefined.
 *
 * @param language The language to get an editor for
 * @returns The editor provider or undefined if no extension provides one
 */
export const getEditor = (
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
export const hasEditor = (language: EditorLanguage): boolean => {
  const manager = EditorProviders.getInstance();
  return manager.hasProvider(language);
};

/**
 * Get all registered editor providers.
 *
 * @returns Array of all registered editor providers
 */
export const getAllEditors = (): EditorProvider[] => {
  const manager = EditorProviders.getInstance();
  return manager.getAllProviders();
};

/**
 * Event fired when an editor is registered.
 * Subscribe to this event to react when extensions register new editors.
 */
export const onDidRegisterEditor = (
  listener: (e: EditorRegisteredEvent) => void,
): Disposable => {
  const manager = EditorProviders.getInstance();
  return manager.onDidRegister(listener);
};

/**
 * Event fired when an editor is unregistered.
 * Subscribe to this event to react when extensions unregister editors.
 */
export const onDidUnregisterEditor = (
  listener: (e: EditorUnregisteredEvent) => void,
): Disposable => {
  const manager = EditorProviders.getInstance();
  return manager.onDidUnregister(listener);
};

/**
 * Editors API object for use in the extension system.
 */
export const editors: typeof editorsApi = {
  registerEditor,
  getEditor,
  hasEditor,
  getAllEditors,
  onDidRegisterEditor,
  onDidUnregisterEditor,
};

export { EditorProviders };

// Component exports
export { default as EditorHost } from './EditorHost';
export type { EditorHostProps } from './EditorHost';
export { default as AceEditorProvider } from './AceEditorProvider';
