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
import { Event, Extension } from './core';

/**
 * Extensions are represented by an {@link Extension}-interface which enables reflection on them.
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
 * to `package.json`, and use the {@link getExtension getExtension}-function
 * and the {@link Extension.exports exports}-property, like below:
 *
 * ```javascript
 * let mathExt = getExtension('genius.math');
 * let importedApi = mathExt.exports;
 *
 * console.log(importedApi.mul(42, 1));
 * ```
 */

/**
 * Get an extension by its full identifier in the form of: `publisher.name`.
 *
 * @param extensionId An extension identifier.
 * @returns An extension or `undefined`.
 */
export declare function getExtension(
  extensionId: string,
): Extension | undefined;

/**
 * All extensions currently known to the system.
 */
export declare const all: readonly Extension[];

/**
 * An event which fires when `all` changes. This can happen when extensions are
 * installed, uninstalled, enabled or disabled.
 */
export declare const onDidChange: Event<void>;
