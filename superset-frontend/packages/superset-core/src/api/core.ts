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
import { ReactElement } from 'react';
import { Contributions } from './contributions';

export declare interface Column {
  name: string;
  type: string;
}
export declare interface Table {
  name: string;
  columns: Column[];
}

export declare interface Catalog {}

export declare interface Schema {
  tables: Table[];
}

export declare interface Database {
  id: number;
  name: string;
  catalogs: Catalog[];
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
 * Represents a typed event.
 *
 * A function that represents an event to which you subscribe by calling it with
 * a listener function as argument.
 *
 * @example
 * item.onDidChange(function(event) { console.log("Event happened: " + event); });
 */
export declare interface Event<T> {
  /**
   * A function that represents an event to which you subscribe by calling it with
   * a listener function as argument.
   *
   * @param listener The listener function will be called when the event happens.
   * @param thisArgs The `this`-argument which will be used when calling the event listener.
   * @returns A disposable which unsubscribes the event listener.
   */
  (listener: (e: T) => any, thisArgs?: any): Disposable;
}

export interface Extension {
  name: string;
  description: string;
  contributions: Contributions;
  exposedModules: string[];
  files: string[];
  remoteEntry: string;
  activate: Function;
  deactivate: Function;
  extensionDependencies: string[];
}

export declare const registerViewProvider: (
  id: string,
  viewProvider: () => ReactElement,
) => Disposable;
