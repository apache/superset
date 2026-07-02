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

import type { dashboards } from '@apache-superset/core';
import { Disposable } from '../models';
import { createEventEmitter } from '../utils';

type DashboardRenderer = dashboards.DashboardRenderer;
type DashboardRendererComponent = dashboards.DashboardRendererComponent;
type DashboardRendererProvider = dashboards.DashboardRendererProvider;
type DashboardRendererRegisteredEvent =
  dashboards.DashboardRendererRegisteredEvent;
type DashboardRendererUnregisteredEvent =
  dashboards.DashboardRendererUnregisteredEvent;

type Listener<T> = (e: T) => void;

/**
 * Singleton manager for the dashboard renderer slot.
 *
 * The dashboard renderer is a single-slot contribution point: at most one
 * provider is active at a time. Registering while the slot is occupied
 * displaces (and unregisters) the previous provider with a console warning —
 * the most recent registration wins.
 */
class DashboardRendererProviders {
  private static instance: DashboardRendererProviders;

  /**
   * The single active provider slot.
   */
  private provider: DashboardRendererProvider | undefined;

  private registerEmitter =
    createEventEmitter<DashboardRendererRegisteredEvent>();

  private unregisterEmitter =
    createEventEmitter<DashboardRendererUnregisteredEvent>();

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
   * Get the singleton instance of DashboardRendererProviders.
   * @returns The singleton instance.
   */
  public static getInstance(): DashboardRendererProviders {
    if (!DashboardRendererProviders.instance) {
      DashboardRendererProviders.instance = new DashboardRendererProviders();
    }
    return DashboardRendererProviders.instance;
  }

  /**
   * Register a dashboard renderer provider.
   * The most recently registered provider occupies the slot; a previously
   * registered provider is displaced and unregistered with a warning.
   *
   * @param renderer The renderer descriptor.
   * @param component The React component implementing the renderer.
   * @returns A Disposable to unregister the provider. Disposing after the
   *   provider has been displaced by a newer registration is a no-op.
   */
  public registerProvider(
    renderer: DashboardRenderer,
    component: DashboardRendererComponent,
  ): Disposable {
    const displaced = this.provider;
    if (displaced) {
      // eslint-disable-next-line no-console
      console.warn(
        `Multiple dashboard renderers registered. Using "${renderer.id}"; ` +
          `discarding "${displaced.renderer.id}".`,
      );
      this.unregisterEmitter.fire({ renderer: displaced.renderer });
    }

    this.provider = { renderer, component };

    // Fire registration event
    this.registerEmitter.fire({ renderer });
    this.syncListeners.forEach(l => l());

    // Return disposable for cleanup
    return new Disposable(() => {
      // No-op when this provider is no longer the active one (displaced).
      if (this.provider?.renderer !== renderer) {
        return;
      }
      this.provider = undefined;
      this.unregisterEmitter.fire({ renderer });
      this.syncListeners.forEach(l => l());
    });
  }

  /**
   * Get the active dashboard renderer provider.
   * @returns The provider or undefined if none is registered.
   */
  public getProvider(): DashboardRendererProvider | undefined {
    return this.provider;
  }

  /**
   * Subscribe to provider registration events.
   * @param listener The listener function.
   * @returns A Disposable to unsubscribe.
   */
  public onDidRegister(
    listener: Listener<DashboardRendererRegisteredEvent>,
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
    listener: Listener<DashboardRendererUnregisteredEvent>,
    thisArgs?: unknown,
  ): Disposable {
    return this.unregisterEmitter.subscribe(listener, thisArgs);
  }

  /**
   * Reset the manager state (for testing purposes).
   */
  public reset(): void {
    this.provider = undefined;
    this.syncListeners.clear();
    this.registerEmitter =
      createEventEmitter<DashboardRendererRegisteredEvent>();
    this.unregisterEmitter =
      createEventEmitter<DashboardRendererUnregisteredEvent>();
  }
}

export default DashboardRendererProviders;
