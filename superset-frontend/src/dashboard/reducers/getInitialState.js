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
/* eslint-disable camelcase */
import { isString } from 'lodash';
import shortid from 'shortid';
import { CategoricalColorNamespace } from '@superset-ui/core';

import { initSliceEntities } from 'src/dashboard/reducers/sliceEntities';
import { getParam } from 'src/modules/utils';
import { applyDefaultFormData } from 'src/explore/store';
import { buildActiveFilters } from 'src/dashboard/util/activeDashboardFilters';
import {
  DASHBOARD_FILTER_SCOPE_GLOBAL,
  dashboardFilter,
} from './dashboardFilters';
import { chart } from '../../chart/chartReducer';
import {
  DASHBOARD_HEADER_ID,
  GRID_DEFAULT_CHART_WIDTH,
  GRID_COLUMN_COUNT,
} from '../util/constants';
import {
  DASHBOARD_HEADER_TYPE,
  CHART_TYPE,
  ROW_TYPE,
} from '../util/componentTypes';
import { buildFilterColorMap } from '../util/dashboardFiltersColorMap';
import findFirstParentContainerId from '../util/findFirstParentContainer';
import getEmptyLayout from '../util/getEmptyLayout';
import getFilterConfigsFromFormdata from '../util/getFilterConfigsFromFormdata';
import getLocationHash from '../util/getLocationHash';
import newComponentFactory from '../util/newComponentFactory';
import { TIME_RANGE } from '../../visualizations/FilterBox/FilterBox';

export default function getInitialState(bootstrapData) {
  const { user_id, datasources, common, editMode, urlParams } = bootstrapData;

  const dashboard = { ...bootstrapData.dashboard_data };
  let preselectFilters = {};
  try {
    // allow request parameter overwrite dashboard metadata
    preselectFilters = JSON.parse(
      getParam('preselect_filters') || dashboard.metadata.default_filters,
    );
  } catch (e) {
    //
  }

  // Priming the color palette with user's label-color mapping provided in
  // the dashboard's JSON metadata
  if (dashboard.metadata && dashboard.metadata.label_colors) {
    const scheme = dashboard.metadata.color_scheme;
    const namespace = dashboard.metadata.color_namespace;
    const colorMap = isString(dashboard.metadata.label_colors)
      ? JSON.parse(dashboard.metadata.label_colors)
      : dashboard.metadata.label_colors;
    Object.keys(colorMap).forEach(label => {
      CategoricalColorNamespace.getScale(scheme, namespace).setColor(
        label,
        colorMap[label],
      );
    });
  }

  // dashboard layout
  const { position_json: positionJson } = dashboard;
  // new dash: positionJson could be {} or null
  const layout =
    positionJson && Object.keys(positionJson).length > 0
      ? positionJson
      : getEmptyLayout();

  // create a lookup to sync layout names with slice names
  const chartIdToLayoutId = {};
  Object.values(layout).forEach(layoutComponent => {
    if (layoutComponent.type === CHART_TYPE) {
      chartIdToLayoutId[layoutComponent.meta.chartId] = layoutComponent.id;
    }
  });

  // find root level chart container node for newly-added slices
  const parentId = findFirstParentContainerId(layout);
  const parent = layout[parentId];
  let newSlicesContainer;
  let newSlicesContainerWidth = 0;

  const filterScopes = dashboard.metadata.filter_scopes || {};

  const chartQueries = {};
  const dashboardFilters = {};
  const slices = {};
  const sliceIds = new Set();
  dashboard.slices.forEach(slice => {
    const key = slice.slice_id;
    const form_data = {
      ...slice.form_data,
      url_params: {
        ...slice.form_data.url_params,
        ...urlParams,
      },
    };
    chartQueries[key] = {
      ...chart,
      id: key,
      form_data,
      formData: applyDefaultFormData(form_data),
    };

    slices[key] = {
      slice_id: key,
      slice_url: slice.slice_url,
      slice_name: slice.slice_name,
      form_data: slice.form_data,
      edit_url: slice.edit_url,
      viz_type: slice.form_data.viz_type,
      datasource: slice.form_data.datasource,
      description: slice.description,
      description_markeddown: slice.description_markeddown,
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
          (parent.parents || []).slice(),
        );
        layout[newSlicesContainer.id] = newSlicesContainer;
        parent.children.push(newSlicesContainer.id);
        newSlicesContainerWidth = 0;
      }

      const chartHolder = newComponentFactory(
        CHART_TYPE,
        {
          chartId: slice.slice_id,
        },
        (newSlicesContainer.parents || []).slice(),
      );

      layout[chartHolder.id] = chartHolder;
      newSlicesContainer.children.push(chartHolder.id);
      chartIdToLayoutId[chartHolder.meta.chartId] = chartHolder.id;
      newSlicesContainerWidth += GRID_DEFAULT_CHART_WIDTH;
    }

    // build DashboardFilters for interactive filter features
    if (slice.form_data.viz_type === 'filter_box') {
      const configs = getFilterConfigsFromFormdata(slice.form_data);
      let { columns } = configs;
      const { labels } = configs;
      if (preselectFilters[key]) {
        Object.keys(columns).forEach(col => {
          if (preselectFilters[key][col]) {
            columns = {
              ...columns,
              [col]: preselectFilters[key][col],
            };
          }
        });
      }

      const scopesByChartId = Object.keys(columns).reduce((map, column) => {
        const scopeSettings = {
          ...filterScopes[key],
        };
        const { scope, immune } = {
          ...DASHBOARD_FILTER_SCOPE_GLOBAL,
          ...scopeSettings[column],
        };

        return {
          ...map,
          [column]: {
            scope,
            immune,
          },
        };
      }, {});

      const componentId = chartIdToLayoutId[key];
      const directPathToFilter = (layout[componentId].parents || []).slice();
      directPathToFilter.push(componentId);
      dashboardFilters[key] = {
        ...dashboardFilter,
        chartId: key,
        componentId,
        datasourceId: slice.form_data.datasource,
        filterName: slice.slice_name,
        directPathToFilter,
        columns,
        labels,
        scopes: scopesByChartId,
        isInstantFilter: !!slice.form_data.instant_filtering,
        isDateFilter: Object.keys(columns).includes(TIME_RANGE),
      };
    }

    // sync layout names with current slice names in case a slice was edited
    // in explore since the layout was updated. name updates go through layout for undo/redo
    // functionality and python updates slice names based on layout upon dashboard save
    const layoutId = chartIdToLayoutId[key];
    if (layoutId && layout[layoutId]) {
      layout[layoutId].meta.sliceName = slice.slice_name;
    }
  });
  buildActiveFilters({
    dashboardFilters,
    components: layout,
  });
  buildFilterColorMap(dashboardFilters, layout);

  // store the header as a layout component so we can undo/redo changes
  layout[DASHBOARD_HEADER_ID] = {
    id: DASHBOARD_HEADER_ID,
    type: DASHBOARD_HEADER_TYPE,
    meta: {
      text: dashboard.dashboard_title,
    },
  };

  const dashboardLayout = {
    past: [],
    present: layout,
    future: [],
  };

  // find direct link component and path from root
  const directLinkComponentId = getLocationHash();
  let directPathToChild = [];
  if (layout[directLinkComponentId]) {
    directPathToChild = (layout[directLinkComponentId].parents || []).slice();
    directPathToChild.push(directLinkComponentId);
  }

  return {
    datasources,
    sliceEntities: { ...initSliceEntities, slices, isLoading: false },
    charts: chartQueries,
    // read-only data
    dashboardInfo: {
      id: dashboard.id,
      slug: dashboard.slug,
      metadata: dashboard.metadata,
      userId: user_id,
      dash_edit_perm: dashboard.dash_edit_perm,
      dash_save_perm: dashboard.dash_save_perm,
      superset_can_explore: dashboard.superset_can_explore,
      superset_can_csv: dashboard.superset_can_csv,
      slice_can_edit: dashboard.slice_can_edit,
      common: {
        flash_messages: common.flash_messages,
        conf: common.conf,
      },
      lastModifiedTime: dashboard.last_modified_time,
    },
    dashboardFilters,
    dashboardState: {
      sliceIds: Array.from(sliceIds),
      directPathToChild,
      directPathLastUpdated: Date.now(),
      // dashboard only has 1 focused filter field at a time,
      // but when user switch different filter boxes,
      // browser didn't always fire onBlur and onFocus events in order.
      // so in redux state focusedFilterField prop is a queue,
      // but component use focusedFilterField prop as single object.
      focusedFilterField: [],
      expandedSlices: dashboard.metadata.expanded_slices || {},
      refreshFrequency: dashboard.metadata.refresh_frequency || 0,
      // dashboard viewers can set refresh frequency for the current visit,
      // only persistent refreshFrequency will be saved to backend
      shouldPersistRefreshFrequency: false,
      css: dashboard.css || '',
      colorNamespace: dashboard.metadata.color_namespace,
      colorScheme: dashboard.metadata.color_scheme,
      editMode: dashboard.dash_edit_perm && editMode,
      isPublished: dashboard.published,
      hasUnsavedChanges: false,
      maxUndoHistoryExceeded: false,
      lastModifiedTime: dashboard.last_modified_time,
    },
    dashboardLayout,
    messageToasts: [],
    impressionId: shortid.generate(),
  };
}
