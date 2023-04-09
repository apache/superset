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

import { TableTab } from 'src/views/CRUD/types';
import { DashboardContextForExplore } from 'src/types/DashboardContextForExplore';

export enum LocalStorageKeys {
  /**
   * START LEGACY LOCAL STORAGE KEYS
   *
   * Do not follow the patterns here for key names. Keys should instead be namespaced to avoid
   * collisions.
   *
   * TODO: Update all local storage keys to follow the new pattern. This is a breaking change,
   * and therefore should be done in a major release.
   */
  filter_box_transition_snoozed_at = 'filter_box_transition_snoozed_at',
  db = 'db',
  chart_split_sizes = 'chart_split_sizes',
  controls_width = 'controls_width',
  datasource_width = 'datasource_width',
  is_datapanel_open = 'is_datapanel_open',
  homepage_chart_filter = 'homepage_chart_filter',
  homepage_dashboard_filter = 'homepage_dashboard_filter',
  homepage_collapse_state = 'homepage_collapse_state',
  homepage_activity_filter = 'homepage_activity_filter',
  datasetname_set_successful = 'datasetname_set_successful',
  /** END LEGACY LOCAL STORAGE KEYS */

  /**
   * New local storage keys should be namespaced to avoid collisions. Keys should be named in the
   * form [namespace]__[key].
   *
   * Example:
   * sqllab__is_autocomplete_enabled
   */
  sqllab__is_autocomplete_enabled = 'sqllab__is_autocomplete_enabled',
  explore__data_table_original_formatted_time_columns = 'explore__data_table_original_formatted_time_columns',
  dashboard__custom_filter_bar_widths = 'dashboard__custom_filter_bar_widths',
  dashboard__explore_context = 'dashboard__explore_context',
  dashboard__editor_show_only_my_charts = 'dashboard__editor_show_only_my_charts',
  common__resizable_sidebar_widths = 'common__resizable_sidebar_widths',
}

export type LocalStorageValues = {
  filter_box_transition_snoozed_at: Record<number, number>;
  db: object | null;
  chart_split_sizes: [number, number];
  controls_width: number;
  datasource_width: number;
  is_datapanel_open: boolean;
  homepage_chart_filter: TableTab;
  homepage_dashboard_filter: TableTab;
  homepage_collapse_state: string[];
  datasetname_set_successful: boolean;
  homepage_activity_filter: TableTab | null;
  sqllab__is_autocomplete_enabled: boolean;
  explore__data_table_original_formatted_time_columns: Record<string, string[]>;
  dashboard__custom_filter_bar_widths: Record<string, number>;
  dashboard__explore_context: Record<string, DashboardContextForExplore>;
  dashboard__editor_show_only_my_charts: boolean;
  common__resizable_sidebar_widths: Record<string, number>;
};

/*
 * This function should not be used directly, as it doesn't provide any type safety or any
 * guarantees that the globally namespaced localstorage key is correct.
 *
 * Instead, use getItem and setItem. Any legacy uses should be updated/migrated in future
 * Superset versions (as they may require breaking changes).
 * */
export function dangerouslyGetItemDoNotUse(
  key: string,
  defaultValue: any,
): any {
  try {
    const value = localStorage.getItem(key);
    if (value === null) {
      return defaultValue;
    }
    return JSON.parse(value);
  } catch {
    return defaultValue;
  }
}

/*
 * This function should not be used directly, as it doesn't provide any type safety or any
 * guarantees that the globally namespaced localstorage key is correct.
 *
 * Instead, use getItem and setItem. Any legacy uses should be updated/migrated in future
 * Superset versions (as they may require breaking changes).
 * */
export function dangerouslySetItemDoNotUse(key: string, value: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Catch in case localStorage is unavailable
  }
}

export function getItem<K extends LocalStorageKeys>(
  key: K,
  defaultValue: LocalStorageValues[K],
): LocalStorageValues[K] {
  return dangerouslyGetItemDoNotUse(key, defaultValue);
}

export function setItem<K extends LocalStorageKeys>(
  key: K,
  value: LocalStorageValues[K],
): void {
  dangerouslySetItemDoNotUse(key, value);
}
