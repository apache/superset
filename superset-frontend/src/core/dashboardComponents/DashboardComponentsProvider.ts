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

import { ComponentType } from 'react';
import type { dashboardComponents as api } from '@apache-superset/core';
import { Disposable } from '../models';
import { createEventEmitter } from '../utils';

type Definition = api.DashboardComponentDefinition;
type Props = api.DashboardComponentProps;
type Registered = api.RegisteredDashboardComponent;

/**
 * Singleton registry for contributed dashboard components. Unlike the chat
 * provider (one active chat), this holds many components keyed by id. Built-in
 * components register here at startup; extensions register at module-load time.
 */
class DashboardComponentsProvider {
  private static instance: DashboardComponentsProvider;

  private components = new Map<string, Registered>();

  // Cached, referentially-stable snapshot for useSyncExternalStore; rebuilt
  // only when the set of components changes.
  private snapshot: Registered[] = [];

  private stateSubscribers = new Set<() => void>();

  private registerEmitter = createEventEmitter<Definition>();

  private unregisterEmitter = createEventEmitter<Definition>();

  public static getInstance(): DashboardComponentsProvider {
    if (!DashboardComponentsProvider.instance) {
      DashboardComponentsProvider.instance = new DashboardComponentsProvider();
    }
    return DashboardComponentsProvider.instance;
  }

  public subscribe = (listener: () => void): (() => void) => {
    this.stateSubscribers.add(listener);
    return () => this.stateSubscribers.delete(listener);
  };

  private notifyState(): void {
    this.snapshot = Array.from(this.components.values());
    this.stateSubscribers.forEach(fn => fn());
  }

  public registerDashboardComponent = (
    definition: Definition,
    component: ComponentType<Props>,
  ): Disposable => {
    if (this.components.has(definition.id)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[Superset] A dashboard component "${definition.id}" is already ` +
          `registered; replacing it.`,
      );
    }
    const entry: Registered = { definition, Component: component };
    this.components.set(definition.id, entry);
    this.registerEmitter.fire(definition);
    this.notifyState();

    return new Disposable(() => {
      // Only remove if this exact registration is still the active one.
      if (this.components.get(definition.id) === entry) {
        this.components.delete(definition.id);
        this.unregisterEmitter.fire(definition);
        this.notifyState();
      }
    });
  };

  public getDashboardComponent = (id: string): Registered | undefined =>
    this.components.get(id);

  public getDashboardComponents = (): Registered[] => this.snapshot;

  public get onDidRegisterDashboardComponent() {
    return this.registerEmitter.subscribe;
  }

  public get onDidUnregisterDashboardComponent() {
    return this.unregisterEmitter.subscribe;
  }
}

export default DashboardComponentsProvider;
