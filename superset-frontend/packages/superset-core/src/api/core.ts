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
 * @fileoverview Core types and utilities for Superset extensions.
 *
 * This module provides fundamental types and interfaces used throughout the
 * Superset extension API. It includes database metadata types, event handling,
 * resource management, and extension lifecycle definitions.
 */

import { ReactElement } from 'react';
import { Contributions } from './contributions';

/**
 * Represents a database column with its name and data type.
 */
export declare interface Column {
  /** The name of the column */
  name: string;
  /** The data type of the column (e.g., 'INTEGER', 'VARCHAR', 'TIMESTAMP') */
  type: string;
}

/**
 * Represents a database table with its name and column definitions.
 */
export declare interface Table {
  /** The name of the table */
  name: string;
  /** Array of columns in this table */
  columns: Column[];
}

/**
 * Represents a database catalog.
 * @todo This interface needs to be expanded with catalog-specific properties.
 */
export declare interface Catalog {} // eslint-disable-line @typescript-eslint/no-empty-interface

/**
 * Represents a database schema containing tables.
 */
export declare interface Schema {
  /** Array of tables in this schema */
  tables: Table[];
}

/**
 * Represents a database connection with its metadata.
 */
export declare interface Database {
  /** Unique identifier for the database */
  id: number;
  /** Display name of the database */
  name: string;
  /** Array of catalogs available in this database */
  catalogs: Catalog[];
  /** Array of schemas available in this database */
  schemas: Schema[];
}

/**
 * Represents a type which can release resources, such
 * as event listening or a timer.
 */
export declare class Disposable {
  /**
   * Combine many disposable-likes into one. You can use this method when having objects with
   * a dispose function which aren't instances of `Disposable`.
   *
   * @param disposableLikes Objects that have at least a `dispose`-function member. Note that asynchronous
   * dispose-functions aren't awaited.
   * @returns Returns a new disposable which, upon dispose, will
   * dispose all provided disposables.
   */
  static from(
    ...disposableLikes: {
      /**
       * Function to clean up resources.
       */
      dispose: () => any;
    }[]
  ): Disposable;

  /**
   * Creates a new disposable that calls the provided function
   * on dispose.
   *
   * *Note* that an asynchronous function is not awaited.
   *
   * @param callOnDispose Function that disposes something.
   */
  constructor(callOnDispose: () => any);

  /**
   * Dispose this object.
   */
  dispose(): any;
}

/**
 * Represents a typed event system for handling asynchronous notifications.
 *
 * A function that represents an event to which you subscribe by calling it with
 * a listener function as argument. This provides a type-safe way to handle
 * events throughout the Superset extension system.
 *
 * @template T The type of data that will be passed to event listeners.
 *
 * @example
 * ```typescript
 * // Subscribe to an event
 * const disposable = myEvent((data) => {
 *   console.log("Event happened:", data);
 * });
 *
 * // Unsubscribe when done
 * disposable.dispose();
 * ```
 */
export declare interface Event<T> {
  /**
   * Subscribe to this event by providing a listener function.
   *
   * @param listener The listener function that will be called when the event is fired.
   *   The function receives the event data as its parameter.
   * @param thisArgs Optional `this` context that will be used when calling the event listener.
   * @returns A Disposable object that can be used to unsubscribe from the event.
   *
   * @example
   * ```typescript
   * const subscription = onSomeEvent((data) => {
   *   console.log('Received:', data);
   * });
   *
   * // Later, clean up the subscription
   * subscription.dispose();
   * ```
   */
  (listener: (e: T) => any, thisArgs?: any): Disposable;
}

/**
 * Represents a Superset extension with its metadata and lifecycle methods.
 * Extensions are modular components that can extend Superset's functionality.
 */
export interface Extension {
  /** Function called when the extension is activated */
  activate: Function;
  /** UI contributions provided by this extension */
  contributions: Contributions;
  /** Function called when the extension is deactivated */
  deactivate: Function;
  /** List of other extensions that this extension depends on */
  dependencies: string[];
  /** Human-readable description of the extension */
  description: string;
  /** List of modules exposed by this extension for use by other extensions */
  exposedModules: string[];
  /** List of other extensions that this extension depends on */
  extensionDependencies: string[];
  /** Unique identifier for the extension */
  id: string;
  /** Human-readable name of the extension */
  name: string;
  /** URL or path to the extension's remote entry point */
  remoteEntry: string;
  /** Version of the extension */
  version: string;
}

/**
 * Context object provided to extensions during activation.
 * Contains utilities and resources that extensions can use during their lifecycle.
 */
export interface ExtensionContext {
  /**
   * Array of disposable objects that will be automatically disposed when the extension is deactivated.
   * Extensions should add any resources that need cleanup to this array.
   *
   * @example
   * ```typescript
   * export function activate(context: ExtensionContext) {
   *   // Register an event listener
   *   const disposable = onSomeEvent(() => { ... });
   *
   *   // Add to context so it's cleaned up automatically
   *   context.disposables.push(disposable);
   * }
   * ```
   */
  disposables: Disposable[];

  /**
   * @todo We might want to add more properties to this interface in the future like
   * storage, configuration, logging, etc. For now, it serves as a placeholder
   * to allow for future extensibility without breaking existing extensions.
   */
}

/**
 * Registers a view provider that can render custom React components in Superset.
 * View providers allow extensions to contribute custom UI components that can be
 * displayed in various parts of the Superset interface.
 *
 * @param id Unique identifier for the view provider. This ID is used to reference
 *   the view provider from other parts of the system.
 * @param viewProvider Function that returns a React element to be rendered.
 *   This function will be called whenever the view needs to be displayed.
 * @returns A Disposable object that can be used to unregister the view provider.
 *
 * @example
 * ```typescript
 * const disposable = registerViewProvider('my-extension.custom-view', () => (
 *   <div>
 *     <h1>My Custom View</h1>
 *     <p>This is a custom component from my extension.</p>
 *   </div>
 * ));
 *
 * // Later, unregister the view provider
 * disposable.dispose();
 * ```
 */
export declare const registerViewProvider: (
  id: string,
  viewProvider: () => ReactElement,
) => Disposable;
