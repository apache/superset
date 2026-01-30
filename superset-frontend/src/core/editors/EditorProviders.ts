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

import type { editors, contributions } from '@apache-superset/core';
import { Disposable } from '../models';

type EditorLanguage = contributions.EditorLanguage;
type EditorProvider = editors.EditorProvider;
type EditorContribution = editors.EditorContribution;
type EditorComponent = editors.EditorComponent;
type EditorProviderRegisteredEvent = editors.EditorProviderRegisteredEvent;
type EditorProviderUnregisteredEvent = editors.EditorProviderUnregisteredEvent;

/**
 * Listener function type for events.
 */
type Listener<T> = (e: T) => void;

/**
 * Simple event emitter for editor provider lifecycle events.
 */
class EventEmitter<T> {
  private listeners: Set<Listener<T>> = new Set();

  /**
   * Subscribe to this event.
   * @param listener The listener function to call when the event is fired.
   * @returns A Disposable to unsubscribe from the event.
   */
  subscribe(listener: Listener<T>): Disposable {
    this.listeners.add(listener);
    return new Disposable(() => {
      this.listeners.delete(listener);
    });
  }

  /**
   * Fire the event with the given data.
   * @param data The event data to pass to listeners.
   */
  fire(data: T): void {
    this.listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error in event listener:', error);
      }
    });
  }
}

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

  /**
   * Event emitter for provider registration events.
   */
  private registerEmitter = new EventEmitter<EditorProviderRegisteredEvent>();

  /**
   * Event emitter for provider unregistration events.
   */
  private unregisterEmitter =
    new EventEmitter<EditorProviderUnregisteredEvent>();

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
   * @param contribution The editor contribution metadata.
   * @param component The React component implementing the editor.
   * @returns A Disposable to unregister the provider.
   */
  public registerProvider(
    contribution: EditorContribution,
    component: EditorComponent,
  ): Disposable {
    const { id, languages } = contribution;

    // Check if provider with this ID already exists
    if (this.providers.has(id)) {
      // eslint-disable-next-line no-console
      console.warn(`Editor provider with id "${id}" is already registered.`);
      return new Disposable(() => {});
    }

    const provider: EditorProvider = {
      contribution,
      component,
    };

    // Register the provider
    this.providers.set(id, provider);

    // Map languages to this provider
    languages.forEach(language => {
      this.languageToProvider.set(language, id);
    });

    // Fire registration event
    this.registerEmitter.fire({ provider });

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

    const { contribution } = provider;

    // Remove language mappings for this provider
    contribution.languages.forEach(language => {
      if (this.languageToProvider.get(language) === id) {
        this.languageToProvider.delete(language);
      }
    });

    // Remove the provider
    this.providers.delete(id);

    // Fire unregistration event
    this.unregisterEmitter.fire({ contribution });
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
    listener: Listener<EditorProviderRegisteredEvent>,
  ): Disposable {
    return this.registerEmitter.subscribe(listener);
  }

  /**
   * Subscribe to provider unregistration events.
   * @param listener The listener function.
   * @returns A Disposable to unsubscribe.
   */
  public onDidUnregister(
    listener: Listener<EditorProviderUnregisteredEvent>,
  ): Disposable {
    return this.unregisterEmitter.subscribe(listener);
  }

  /**
   * Reset the manager state (for testing purposes).
   */
  public reset(): void {
    this.providers.clear();
    this.languageToProvider.clear();
  }
}

export default EditorProviders;
