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
import { JsonObject } from '@superset-ui/core';
import { chart } from 'src/components/Chart/chartReducer';
import { applyDefaultFormData } from 'src/explore/store';
import {
  DASHBOARD_HEADER_ID,
  GRID_DEFAULT_CHART_WIDTH,
  GRID_COLUMN_COUNT,
  DASHBOARD_ROOT_ID,
} from './constants';
import { DASHBOARD_HEADER_TYPE, CHART_TYPE, ROW_TYPE } from './componentTypes';
import findFirstParentContainerId from './findFirstParentContainer';
import getEmptyLayout from './getEmptyLayout';
import newComponentFactory, { DashboardEntity } from './newComponentFactory';
import updateComponentParentsList from './updateComponentParentsList';
import type { DashboardLayout, LayoutItem } from '../types';

export interface HydrateChartData {
  slice_id: number;
  slice_url: string;
  slice_name: string;
  form_data: JsonObject;
  description: string;
  description_markeddown: string;
  owners: { id: number }[];
  modified: string;
  changed_on: string;
}

interface BuildDashboardLayoutParams {
  dashboardTitle: string;
  positionData: Record<string, LayoutItem> | null;
  charts: HydrateChartData[];
  regularUrlParams: JsonObject;
}

interface BuildDashboardLayoutResult {
  layout: Record<string, LayoutItem | DashboardEntity>;
  chartQueries: Record<string, JsonObject>;
  slices: Record<string, JsonObject>;
  sliceIds: Set<number>;
}

/**
 * Pure build of a dashboard's layout tree and chart data from `position_data`
 * plus chart payloads; slices from Explore with no layout node are appended
 * into fresh rows. Extracted from `hydrateDashboard` to be unit-testable.
 */
export default function buildDashboardLayout({
  dashboardTitle,
  positionData,
  charts,
  regularUrlParams,
}: BuildDashboardLayoutParams): BuildDashboardLayoutResult {
  // new dash: position_json could be {} or null
  const layout = (
    positionData && Object.keys(positionData).length > 0
      ? positionData
      : getEmptyLayout()
  ) as Record<string, LayoutItem | DashboardEntity>;

  // create a lookup to sync layout names with slice names
  const chartIdToLayoutId: Record<number, string> = {};
  Object.values(layout).forEach(layoutComponent => {
    if (layoutComponent.type === CHART_TYPE) {
      const { chartId } = (layoutComponent as LayoutItem).meta;
      if (chartId !== undefined) {
        chartIdToLayoutId[chartId] = layoutComponent.id;
      }
    }
  });

  // find root level chart container node for newly-added slices
  const parentId = findFirstParentContainerId(layout as DashboardLayout);
  const parent = layout[parentId];
  let newSlicesContainer: DashboardEntity | undefined;
  let newSlicesContainerWidth = 0;

  const chartQueries: Record<string, JsonObject> = {};
  const slices: Record<string, JsonObject> = {};
  const sliceIds = new Set<number>();
  const slicesFromExploreCount = new Map<number, number>();

  charts.forEach((slice: HydrateChartData) => {
    const key = slice.form_data.slice_id as number;
    const formData = {
      ...slice.form_data,
      url_params: {
        ...(slice.form_data.url_params as JsonObject),
        ...regularUrlParams,
      },
    };
    chartQueries[key] = {
      ...chart,
      id: key,
      form_data: applyDefaultFormData(
        formData as Parameters<typeof applyDefaultFormData>[0],
      ),
    };

    slices[key] = {
      slice_id: key,
      slice_url: slice.slice_url,
      slice_name: slice.slice_name,
      form_data: slice.form_data,
      viz_type: slice.form_data.viz_type,
      datasource: slice.form_data.datasource,
      description: slice.description,
      description_markdown: slice.description_markeddown,
      owners: slice.owners,
      modified: slice.modified,
      changed_on: new Date(slice.changed_on).getTime(),
    };

    sliceIds.add(key);

    // if there are newly added slices from explore view, fill slices into 1 or more rows
    if (!chartIdToLayoutId[key] && layout[parentId]) {
      if (
        newSlicesContainerWidth === 0 ||
        newSlicesContainerWidth + GRID_DEFAULT_CHART_WIDTH > GRID_COLUMN_COUNT
      ) {
        newSlicesContainer = newComponentFactory(
          ROW_TYPE,
          undefined,
          ((parent as LayoutItem).parents ?? []).slice(),
        );
        layout[newSlicesContainer.id] = newSlicesContainer;
        parent.children.push(newSlicesContainer.id);
        newSlicesContainerWidth = 0;
      }

      const chartHolder = newComponentFactory(
        CHART_TYPE,
        { chartId: key },
        (newSlicesContainer!.parents || []).slice(),
      );

      const count = (slicesFromExploreCount.get(key) ?? 0) + 1;
      chartHolder.id = `${CHART_TYPE}-explore-${key}-${count}`;
      slicesFromExploreCount.set(key, count);

      layout[chartHolder.id] = chartHolder;
      newSlicesContainer!.children.push(chartHolder.id);
      const holderChartId = chartHolder.meta.chartId;
      if (holderChartId !== undefined) {
        chartIdToLayoutId[holderChartId] = chartHolder.id;
      }
      newSlicesContainerWidth += GRID_DEFAULT_CHART_WIDTH;
    }

    // sync layout names with current slice names in case a slice was edited
    // in explore since the layout was updated. name updates go through layout for undo/redo
    // functionality and python updates slice names based on layout upon dashboard save
    const layoutId = chartIdToLayoutId[key];
    if (layoutId && layout[layoutId]) {
      (layout[layoutId] as LayoutItem).meta.sliceName = slice.slice_name;
    }
  });

  // make sure that parents tree is built
  if (
    Object.values(layout).some(
      element => element.id !== DASHBOARD_ROOT_ID && !element.parents,
    )
  ) {
    updateComponentParentsList({
      currentComponent: layout[DASHBOARD_ROOT_ID] as LayoutItem,
      layout: layout as Record<string, LayoutItem>,
    });
  }

  // store the header as a layout component so we can undo/redo changes
  layout[DASHBOARD_HEADER_ID] = {
    id: DASHBOARD_HEADER_ID,
    type: DASHBOARD_HEADER_TYPE,
    meta: {
      text: dashboardTitle,
    },
  } as LayoutItem;

  return { layout, chartQueries, slices, sliceIds };
}
