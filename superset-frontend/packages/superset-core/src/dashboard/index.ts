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
 * @fileoverview Dashboard API for Superset extensions.
 *
 * This module gives an extension the context a dashboard surface needs from
 * the host, and the one action on a dashboard an extension cannot perform
 * itself: committing the edits the author has made.
 *
 * It follows the same shape as the SQL Lab API. A view contributed to a
 * dashboard location asks this namespace for the state it needs rather than
 * receiving it, so what a location supplies is not part of the published view
 * contract and can change without breaking an extension that reads it.
 */

import { Event } from '../common';

/**
 * Whether the dashboard on screen has edits that have not been saved.
 *
 * `false` when no dashboard is open, when one is open but not being edited,
 * and when it is being edited but nothing has changed since the last save.
 *
 * An action contributed beside Save needs this for two different reasons: to
 * say whether there is anything to save, and because the thing it acts on
 * does not exist until the save has happened.
 *
 * @returns `true` when the open dashboard holds unsaved edits.
 *
 * @example
 * ```typescript
 * if (dashboard.hasUnsavedChanges()) {
 *   await dashboard.save();
 * }
 * ```
 */
export declare const hasUnsavedChanges: () => boolean;

/**
 * Fires when the answer to {@link hasUnsavedChanges} changes.
 *
 * A view that reads `hasUnsavedChanges` is not re-rendered by the host when
 * the answer changes, so a surface whose appearance depends on it -- a button
 * that is disabled until there is something to save, a label that changes
 * wording -- subscribes here and re-renders itself.
 *
 * Fires only on a change: saving a dashboard that had edits fires once with
 * `false`, and editing it again fires once with `true`.
 *
 * @example
 * ```typescript
 * const subscription = dashboard.onDidChangeUnsavedChanges(unsaved => {
 *   setDirty(unsaved);
 * });
 * ```
 */
export declare const onDidChangeUnsavedChanges: Event<boolean>;

/**
 * Saves the dashboard's current edits, as the host's own Save does.
 *
 * An extension cannot save a dashboard itself: the edits live in the host's
 * store, and only the host knows how to turn them into the saved dashboard.
 * An action that has to capture the author's current work before it can act
 * on that work calls this first.
 *
 * Resolves without doing anything when no dashboard is being edited, so a
 * caller that is not sure whether there is anything to save can ask
 * {@link hasUnsavedChanges} rather than guard against throwing.
 *
 * @returns A promise that resolves once the save has been started.
 *
 * @example
 * ```typescript
 * await dashboard.save();
 * ```
 */
export declare function save(): Promise<void>;
