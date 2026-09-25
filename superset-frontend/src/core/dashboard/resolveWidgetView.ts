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
import type { ReactElement } from 'react';
import { DASHBOARD_WIDGETS_LOCATION } from '@apache-superset/core/widgets';
import { resolveView, views } from 'src/core/views';

/**
 * The `views` location a dashboard node's `type` must be registered at to
 * be renderable as a widget — built-in types (markdown/echarts/...,
 * see `registerBuiltInWidgets`) and extension-contributed ones
 * register here identically, through the same `views.registerView` call.
 * The root's own type (`grid`) is deliberately not among them — it is not
 * a Widget, and `WidgetView` resolves its renderer directly
 * rather than through this location.
 *
 * It lives in `@apache-superset/core` with the rest of the widget contract:
 * an extension registers against it, and an embedded page resolves the same
 * location when it loads that extension's widget.
 */
export { DASHBOARD_WIDGETS_LOCATION };

/**
 * Whether `type` is renderable as a widget at all — registered here by the
 * host or contributed by an extension. Not the same question as whether its
 * component happens to live in `@apache-superset/widgets`: an extension's
 * widget is fetched from Superset by whoever renders it, including an
 * embedding host (see `extensionLoader`).
 */
export const isWidgetViewRegistered = (type: string): boolean =>
  views.getViews(DASHBOARD_WIDGETS_LOCATION)?.some(view => view.id === type) ??
  false;

/**
 * Resolves a node's registered view, scoped to
 * `DASHBOARD_WIDGETS_LOCATION` — `resolveView` alone resolves by id
 * only, ignoring location, so without this check a node whose `type`
 * happened to collide with some unrelated view id registered elsewhere in
 * the app could render the wrong thing. Returns undefined if no building
 * widget is registered for `type`, so the caller can fall back to an
 * "unsupported" placeholder.
 */
export function resolveWidgetView(
  type: string,
  nodeId: string,
): ReactElement | undefined {
  if (!isWidgetViewRegistered(type)) return undefined;
  return resolveView(type, { nodeId });
}
