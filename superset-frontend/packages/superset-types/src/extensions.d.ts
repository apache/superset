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
import { Event } from './core';

/**
 * Namespace for dealing with installed extensions. Extensions are represented
 * by an {@link Extension}-interface which enables reflection on them.
 *
 * Extension writers can provide APIs to other extensions by returning their API public
 * surface from the `activate`-call.
 *
 * ```javascript
 * export function activate(context: vscode.ExtensionContext) {
 * 	let api = {
 * 		sum(a, b) {
 * 			return a + b;
 * 		},
 * 		mul(a, b) {
 * 			return a * b;
 * 		}
 * 	};
 * 	// 'export' public api-surface
 * 	return api;
 * }
 * ```
 * When depending on the API of another extension add an `extensionDependencies`-entry
 * to `package.json`, and use the {@link extensions.getExtension getExtension}-function
 * and the {@link Extension.exports exports}-property, like below:
 *
 * ```javascript
 * let mathExt = extensions.getExtension('genius.math');
 * let importedApi = mathExt.exports;
 *
 * console.log(importedApi.mul(42, 1));
 * ```
 */
export declare namespace extensions {
  /**
   * Represents an extension.
   *
   * To get an instance of an `Extension` use {@link extensions.getExtension getExtension}.
   */
  export interface Extension<T> {
    /**
     * The canonical extension identifier in the form of: `publisher.name`.
     */
    readonly id: string;

    /**
     * `true` if the extension has been activated.
     */
    readonly isActive: boolean;

    /**
     * The parsed contents of the extension's package.json.
     */
    readonly packageJSON: any;

    /**
     * The public API exported by this extension (return value of `activate`).
     * It is an invalid action to access this field before this extension has been activated.
     */
    readonly exports: T;

    /**
     * Activates this extension and returns its public API.
     *
     * @returns A promise that will resolve when this extension has been activated.
     */
    activate(): Promise<T>;
  }

  /**
   * Get an extension by its full identifier in the form of: `publisher.name`.
   *
   * @param extensionId An extension identifier.
   * @returns An extension or `undefined`.
   */
  export function getExtension<T = any>(
    extensionId: string,
  ): Extension<T> | undefined;

  /**
   * All extensions currently known to the system.
   */
  export const all: readonly Extension<any>[];

  /**
   * An event which fires when `extensions.all` changes. This can happen when extensions are
   * installed, uninstalled, enabled or disabled.
   */
  export const onDidChange: Event<void>;
}
