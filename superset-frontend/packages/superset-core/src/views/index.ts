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
 * @fileoverview Views registration API for Superset extensions.
 *
 * Extensions register React views at named locations using `registerView`.
 * Registrations happen as module-level side effects at import time.
 *
 * Built-in locations:
 *  - `sqllab.panels` / `sqllab.rightSidebar` / … — SQL Lab surface
 *  - `superset.chatbot` — app-shell chatbot bubble (singleton; host renders one)
 */

import { ReactElement } from 'react';
import { Disposable } from '../common';

/**
 * Represents a contributed view in the application.
 */
export interface View {
  /** The unique identifier for the view. */
  id: string;
  /** The display name of the view. */
  name: string;
  /** Optional description of the view, for display in contribution manifests. */
  description?: string;
  /**
   * Optional icon identifier for the view, used in admin pickers and manifest
   * listings. Static — set once at registerView() time.
   * Dynamic icon states (e.g. notification badge) are the extension's concern.
   */
  icon?: string;
}

/**
 * Registers a custom view at a specific UI location.
 *
 * @param view The view descriptor (id, name, and optional icon/description).
 * @param location The location where this view should appear.
 * @param provider A function that returns the React element to render.
 * @returns A Disposable that unregisters the view when disposed.
 *
 * @example SQL Lab panel
 * ```typescript
 * views.registerView(
 *   { id: 'my_ext.result_stats', name: 'Result Stats' },
 *   'sqllab.panels',
 *   () => <ResultStatsPanel />,
 * );
 * ```
 *
 * @example Chatbot bubble (`superset.chatbot` — singleton, host renders one)
 * ```typescript
 * views.registerView(
 *   { id: 'my_ext.chatbot', name: 'My Chatbot', icon: 'Bubble' },
 *   'superset.chatbot',
 *   () => <ChatbotApp />,
 * );
 * ```
 */
export declare function registerView(
  view: View,
  location: string,
  provider: () => ReactElement,
): Disposable;

/**
 * Narrowed descriptor for chatbot contributions (`superset.chatbot` location).
 *
 * Extension authors should use this type when calling `registerView` for the
 * chatbot area. It is identical to {@link View} but makes the registration
 * intent explicit and allows future narrowing (e.g. required `icon`).
 *
 * @example
 * ```typescript
 * const chatbot: ChatbotView = { id: 'my_ext.chatbot', name: 'My Chatbot', icon: 'Bubble' };
 * views.registerView(chatbot, 'superset.chatbot', () => <ChatbotApp />);
 * ```
 */
export type ChatbotView = View;

/**
 * Retrieves all views registered at a specific location.
 *
 * @param location The location to retrieve registered views for (e.g. "sqllab.panels").
 * @returns An array of View objects, or undefined if none are registered.
 *
 * @example
 * ```typescript
 * const panelViews = views.getViews('sqllab.panels');
 * ```
 */
export declare function getViews(location: string): View[] | undefined;
