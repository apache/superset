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
 * @fileoverview Manifest schema for Superset extension contributions.
 *
 * This module defines the aggregate interfaces used by the extension.json
 * manifest and the `superset-extensions` build command. Individual metadata
 * types are defined in their respective namespace modules (commands, views,
 * menus, editors, chat) and re-exported here for the manifest schema.
 */

import { Chat } from '../chat';
import { Command } from '../commands';
import { View } from '../views';
import { Menu } from '../menus';
import { Editor } from '../editors';

/**
 * Valid locations within SQL Lab.
 */
export type SqlLabLocation =
  | 'leftSidebar'
  | 'rightSidebar'
  | 'panels'
  | 'editor'
  | 'statusBar'
  | 'results'
  | 'queryHistory';

/**
 * Valid locations within a dashboard.
 */
export type DashboardLocation =
  /** Beside the dashboard title, alongside the host's own header actions. */
  | 'header'
  /** Inside the dashboard's own overflow ("...") menu. */
  | 'headerActions'
  /**
   * The row of actions shown while the dashboard is in edit mode, after the
   * host's own Discard and Save. The view is given `hasUnsavedChanges` and a
   * `saveFirst` callback, because whether there is anything to save, and the
   * saving itself, are the host's to know and to do.
   */
  | 'editActions'
  /**
   * Between the dashboard header and the chart grid, full width -- the
   * dashboard's twin of `explore.panel`, and the shape a banner wants. A
   * side panel belongs in `sidebar`: in the flow here its height pushes the
   * charts down the page.
   */
  | 'panel'
  /**
   * A column down the right-hand side of the dashboard, beside the chart
   * grid. The column takes no width when nothing is contributed to it, so a
   * dashboard with no extensions is laid out exactly as before.
   */
  | 'sidebar'
  /** Inside an individual chart's overflow ("...") menu. */
  | 'chartActions';

/**
 * Valid locations within Explore.
 */
export type ExploreLocation =
  /** Beside the chart title, alongside the host's own header actions. */
  | 'header'
  /** Between the Explore header and the chart itself, full width. */
  | 'panel';

/**
 * Valid locations within a list view (charts, dashboards, datasets).
 */
/**
 * Valid locations within a chart as a dashboard draws it.
 */
export type DashboardChartLocation =
  /**
   * Beside the chart's name in its header, where a list view's `nameCell`
   * sits for the same asset. For a mark that belongs to the chart rather
   * than to the actions you can take on it -- the actions menu is
   * `dashboard.chartActions`, and is a different question.
   */
  'nameCell';

export type ListViewLocation =
  /**
   * Beside an item's name, in the name cell. Preferred over a column of its
   * own for anything usually absent: an empty column costs every reader width
   * on every row.
   */
  | 'nameCell'
  /**
   * Beside the item's own status, on a list that shows one.
   *
   * Where what is contributed is itself a statement of state, it belongs
   * with the host's: a reader looking for "what is going on with this row"
   * then finds both in one place rather than at opposite ends of it. Only
   * the dashboard list has such a column today; elsewhere `nameCell` is
   * where a tag goes.
   */
  | 'statusCell'
  /** In the row's group of action buttons. */
  | 'actions'
  /**
   * Inside the confirmation shown before an item is deleted, under the
   * host's own description of what deleting it will do.
   *
   * For a consequence the host cannot know about. The host words the
   * confirmation from what it can see -- whether the delete will be held,
   * whether the item can be recovered afterwards -- and an extension may
   * have a further one to add, which the reader needs before they confirm
   * rather than after.
   */
  | 'deleteConfirmation';

/**
 * The list views that accept contributions.
 */
export type ListViewScope = 'chart' | 'dashboard' | 'dataset';

/**
 * Valid locations within the navigation bar.
 *
 * The right-hand end is the only one: the left-hand side is the navigation
 * itself, which an extension reaches by contributing a page rather than a
 * view, so that the entry and the screen it opens stay one declaration.
 */
export type NavbarLocation =
  /**
   * The right-hand end of the navigation bar, ahead of the host's own
   * controls. Visible on every page, so what goes here should be a single
   * compact control -- a status indicator, a trigger for a panel the
   * extension owns -- rather than anything that needs room.
   */
  'right';

/**
 * Valid locations on the Home page.
 */
export type HomeLocation =
  /**
   * A full-width collapsible section of the Home page, after the host's own.
   * The view's `name` is the section's heading, so it is read by someone who
   * has not opened the section yet; the component is rendered when they do.
   */
  | 'section'
  /**
   * The same, but above the host's own sections.
   *
   * For work that is waiting on the reader rather than a view of what already
   * exists -- the one thing on the page that someone else is blocked on.
   * Below the host's sections it sits under Recents, Dashboards, Charts and
   * Saved queries, which is off the bottom of most windows. A contribution
   * that is merely another way to browse belongs in `section`.
   */
  | 'sectionPrimary';

/**
 * Nested structure for view contributions by scope and location.
 * @example
 * {
 *   sqllab: {
 *     panels: [{ id: "my-ext.panel", name: "My Panel" }],
 *     leftSidebar: [{ id: "my-ext.sidebar", name: "My Sidebar" }]
 *   },
 *   dashboard: {
 *     sidebar: [{ id: "my-ext.review", name: "Review" }]
 *   }
 * }
 */
export interface ViewContributions {
  sqllab?: Partial<Record<SqlLabLocation, View[]>>;
  dashboard?: Partial<Record<DashboardLocation, View[]>>;
  explore?: Partial<Record<ExploreLocation, View[]>>;
  listView?: Partial<
    Record<ListViewScope, Partial<Record<ListViewLocation, View[]>>>
  >;
  navbar?: Partial<Record<NavbarLocation, View[]>>;
  home?: Partial<Record<HomeLocation, View[]>>;
}

/**
 * Nested structure for menu contributions by scope and location.
 * @example
 * {
 *   sqllab: {
 *     editor: { primary: [...], secondary: [...] }
 *   }
 * }
 */
export interface MenuContributions {
  sqllab?: Partial<Record<SqlLabLocation, Menu>>;
}

/**
 * Aggregates all contributions (commands, menus, views, editors, and chat)
 * provided by an extension or module.
 */
/**
 * A page as it is declared in the manifest.
 *
 * Keyed by the id of a view the extension registers at the page location, and
 * carrying one thing the runtime view does not: the permission that guards the
 * page's URL. The host serves the application shell at `/extensions/pages/<id>`
 * so a cold load, a refresh or a bookmark resolves, and that server-side route
 * has to be guarded like any other page in Superset. Naming an existing
 * permission -- the resource the extension's own API registers -- means nothing
 * new has to be created and granted before the page is reachable.
 *
 * A page that declares none is reachable by any signed-in user, which is what
 * the host's own login-gated shell pages already are.
 */
export interface PageContribution extends View {
  permission?: {
    /** FAB resource name, e.g. the extension API's `class_permission_name`. */
    resource: string;
    /** FAB action name. Defaults to `read`. */
    action?: string;
  };
}

export interface Contributions {
  /** List of commands. */
  commands: Command[];
  /** Nested mapping of menu contributions by scope and location. */
  menus: MenuContributions;
  /** Nested mapping of view contributions by scope and location. */
  views: ViewContributions;
  /**
   * Top-level pages contributed by the extension. Each names a view the
   * extension registers at the page location, which the host serves at
   * `/extensions/pages/<id>` -- so unlike a view it is not a slot inside a
   * surface the host already ships.
   */
  pages?: PageContribution[];
  /** List of editors. */
  editors?: Editor[];
  /**
   * The chat contributed by the extension — at most one per extension, since
   * the host applies singleton resolution and renders exactly one active
   * chat at a time.
   */
  chat?: Chat;
}
