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
 * Global (non-SQL-Lab-scoped) view/menu locations for extension
 * integration. Unlike `src/SqlLab/contributions.ts`, these locations
 * aren't declared via the manifest `contributions.views`/`contributions.menus`
 * field -- `ViewContributions`/`MenuContributions` in `superset-core`
 * only accept a `sqllab` scope today -- so extensions register against
 * them imperatively instead.
 *
 * This constant is internal to the Superset app; it isn't exported from
 * `@apache-superset/core`, so extensions reference these locations by
 * their literal string values instead of importing `GlobalLocations`.
 * The Settings menu host only renders the `primary` group.
 *
 * @example
 * ```typescript
 * import { menus, views } from '@apache-superset/core';
 *
 * views.registerView(
 *   { id: 'my-ext.settings', name: 'My Settings' },
 *   'global.settingsPanel',
 *   MySettingsPanel,
 * );
 * menus.registerMenuItem(
 *   { view: 'my-ext.settings', command: 'my-ext.openSettings' },
 *   'global.settingsMenu',
 *   'primary',
 * );
 * ```
 *
 * // In component code:
 * const menu = useMenu(GlobalLocations.settings.menu);
 */
export const GlobalLocations = {
  settings: {
    /** The "Settings" dropdown in the top navigation bar. */
    menu: 'global.settingsMenu',
    /**
     * Full-page views reachable from `settings.menu` items, rendered at
     * `/extensions/view/:viewId` (see `src/views/routes.tsx`).
     */
    panel: 'global.settingsPanel',
  },
} as const;
