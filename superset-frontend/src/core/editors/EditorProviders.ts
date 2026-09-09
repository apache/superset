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

import type { editors } from '@apache-superset/core';
import { Disposable } from '../models';
import { createEventEmitter } from '../utils';

type EditorLanguage = editors.EditorLanguage;
type EditorProvider = editors.EditorProvider;
type Editor = editors.Editor;
type EditorComponent = editors.EditorComponent;
type EditorRegisteredEvent = editors.EditorRegisteredEvent;
type EditorUnregisteredEvent = editors.EditorUnregisteredEvent;

type Listener<T> = (e: T) => void;

/**
 * Singleton manager for editor providers.
 * Handles registration, resolution, and lifecycle of custom editor implementations.
 */
class EditorProviders {
  private static instance: EditorProviders;

  /**
   * Map of provider ID to EditorProvider.
   */
  private providers: Map<string, EditorProvider> = new Map();

  /**
   * Map of language to provider ID for quick lookups.
   */
  private languageToProvider: Map<EditorLanguage, string> = new Map();

  private registerEmitter = createEventEmitter<EditorRegisteredEvent>();

  private unregisterEmitter = createEventEmitter<EditorUnregisteredEvent>();

  private syncListeners: Set<() => void> = new Set();

  /**
   * Stable-reference subscribe function for useSyncExternalStore.
   * Defined as an arrow property so the reference is bound to this instance at construction.
   */
  public subscribe = (listener: () => void): (() => void) => {
    this.syncListeners.add(listener);
    return () => this.syncListeners.delete(listener);
  };

  // eslint-disable-next-line no-useless-constructor
  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance of EditorProviders.
   * @returns The singleton instance.
   */
  public static getInstance(): EditorProviders {
    if (!EditorProviders.instance) {
      EditorProviders.instance = new EditorProviders();
    }
    return EditorProviders.instance;
  }

  /**
   * Register an editor provider.
   * When registered, the provider replaces the default editor for its supported languages.
   *
   * @param editor The editor descriptor.
   * @param component The React component implementing the editor.
   * @returns A Disposable to unregister the provider.
   */
  public registerProvider(
    editor: Editor,
    component: EditorComponent,
  ): Disposable {
    const { id, languages } = editor;

    // Check if provider with this ID already exists
    if (this.providers.has(id)) {
      // eslint-disable-next-line no-console
      console.warn(`Editor provider with id "${id}" is already registered.`);
      return new Disposable(() => {});
    }

    const provider: EditorProvider = {
      editor,
      component,
    };

    // Register the provider
    this.providers.set(id, provider);

    // Map languages to this provider
    languages.forEach(language => {
      this.languageToProvider.set(language, id);
    });

    // Fire registration event
    this.registerEmitter.fire({ editor });
    this.syncListeners.forEach(l => l());

    // Return disposable for cleanup
    return new Disposable(() => {
      this.unregisterProvider(id);
    });
  }

  /**
   * Unregister an editor provider by ID.
   * @param id The provider ID to unregister.
   */
  private unregisterProvider(id: string): void {
    const provider = this.providers.get(id);
    if (!provider) {
      return;
    }

    const { editor } = provider;

    // Remove language mappings for this provider
    editor.languages.forEach(language => {
      if (this.languageToProvider.get(language) === id) {
        this.languageToProvider.delete(language);
      }
    });

    // Remove the provider
    this.providers.delete(id);

    // Fire unregistration event
    this.unregisterEmitter.fire({ editor });
    this.syncListeners.forEach(l => l());
  }

  /**
   * Get the editor provider for a specific language.
   * @param language The language to get a provider for.
   * @returns The provider or undefined if none is registered.
   */
  public getProvider(language: EditorLanguage): EditorProvider | undefined {
    const providerId = this.languageToProvider.get(language);
    if (!providerId) {
      return undefined;
    }
    return this.providers.get(providerId);
  }

  /**
   * Check if a provider is registered for a language.
   * @param language The language to check.
   * @returns True if a provider is registered.
   */
  public hasProvider(language: EditorLanguage): boolean {
    return this.languageToProvider.has(language);
  }

  /**
   * Get all registered providers.
   * @returns Array of all registered providers.
   */
  public getAllProviders(): EditorProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Subscribe to provider registration events.
   * @param listener The listener function.
   * @returns A Disposable to unsubscribe.
   */
  public onDidRegister(
    listener: Listener<EditorRegisteredEvent>,
    thisArgs?: unknown,
  ): Disposable {
    return this.registerEmitter.subscribe(listener, thisArgs);
  }

  /**
   * Subscribe to provider unregistration events.
   * @param listener The listener function.
   * @returns A Disposable to unsubscribe.
   */
  public onDidUnregister(
    listener: Listener<EditorUnregisteredEvent>,
    thisArgs?: unknown,
  ): Disposable {
    return this.unregisterEmitter.subscribe(listener, thisArgs);
  }

  /**
   * Reset the manager state (for testing purposes).
   */
  public reset(): void {
    this.providers.clear();
    this.languageToProvider.clear();
    this.syncListeners.clear();
    this.registerEmitter = createEventEmitter<EditorRegisteredEvent>();
    this.unregisterEmitter = createEventEmitter<EditorUnregisteredEvent>();
  }
}

export default EditorProviders;
