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
import shortid from 'shortid';
import { CategoricalColorNamespace } from '@superset-ui/color';

import { chart } from '../../chart/chartReducer';
import { initSliceEntities } from './sliceEntities';
import { getParam } from '../../modules/utils';
import { applyDefaultFormData } from '../../explore/store';
import findFirstParentContainerId from '../util/findFirstParentContainer';
import getEmptyLayout from '../util/getEmptyLayout';
import newComponentFactory from '../util/newComponentFactory';
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

export default function(bootstrapData) {
  const { user_id, datasources, common, editMode } = bootstrapData;

  const dashboard = { ...bootstrapData.dashboard_data };

  // Priming the color palette with user's label-color mapping provided in
  // the dashboard's JSON metadata
  if (dashboard.metadata && dashboard.metadata.label_colors) {
    const colorMap = dashboard.metadata.label_colors;
    Object.keys(colorMap).forEach(label => {
      CategoricalColorNamespace.getScale().setColor(label, colorMap[label]);
    });
  }

  // dashboard layout
  const { position_json: positionJson } = dashboard;
  const layout = positionJson || getEmptyLayout();

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

  const chartQueries = {};
  const slices = {};
  const sliceIds = new Set();
  dashboard.slices.forEach(slice => {
    const key = slice.slice_id;
    if (['separator', 'markup'].indexOf(slice.form_data.viz_type) === -1) {
      chartQueries[key] = {
        ...chart,
        id: key,
        form_data: slice.form_data,
        formData: applyDefaultFormData(slice.form_data),
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
          newSlicesContainer = newComponentFactory(ROW_TYPE);
          layout[newSlicesContainer.id] = newSlicesContainer;
          parent.children.push(newSlicesContainer.id);
          newSlicesContainerWidth = 0;
        }

        const chartHolder = newComponentFactory(CHART_TYPE, {
          chartId: slice.slice_id,
        });

        layout[chartHolder.id] = chartHolder;
        newSlicesContainer.children.push(chartHolder.id);
        chartIdToLayoutId[chartHolder.meta.chartId] = chartHolder.id;
        newSlicesContainerWidth += GRID_DEFAULT_CHART_WIDTH;
      }
    }

    // sync layout names with current slice names in case a slice was edited
    // in explore since the layout was updated. name updates go through layout for undo/redo
    // functionality and python updates slice names based on layout upon dashboard save
    const layoutId = chartIdToLayoutId[key];
    if (layoutId && layout[layoutId]) {
      layout[layoutId].meta.sliceName = slice.slice_name;
    }
  });

  // applied filters
  let filters = {};
  try {
    // preselect_filters={filterId: {cols: [vals]}}
    const preselectFiltersParam = JSON.parse(
      getParam('preselect_filters') || dashboard.metadata.default_filters,
    );

    // accept both old-style filters ({<filter_box_id>: { "col": ["val"], "__timegrain": "val"}})
    // and new-style filters ({"col": ["val"], "col": ["val"]})
    const preselectFilters = {};

    const filterColumns = {};
    Object.keys(preselectFiltersParam).forEach(key => {
      const values = preselectFiltersParam[key];
      if (Array.isArray(values)) {
        // new-style filter, collect a list of {column: [vals]} filter objects
        const currentVals = filterColumns[key] || [];
        filterColumns[key] = [...currentVals, ...values];
      } else {
        // old-style filter, add to preselect filters directly
        const currentVals = preselectFilters[key];
        preselectFilters[key] = {
          ...currentVals,
          ...values,
        };
      }
    });

    const filterBoxes = Object.values(slices).filter(
      slice => slice.viz_type === 'filter_box',
    );
    // for each filter_box, add a filter object if the filter_box uses the column
    Object.keys(filterColumns).forEach(column => {
      const values = filterColumns[column];
      filterBoxes
        .filter(slice =>
          slice.form_data.filter_configs.map(fc => fc.column).includes(column),
        )
        .forEach(slice => {
          const currentVals = preselectFilters[slice.slice_id];
          preselectFilters[slice.slice_id] = {
            ...currentVals,
            [column]: values,
          };
        });
    });

    // allow request parameters to overwrite dashboard metadata
    filters = preselectFilters;
  } catch (e) {
    //
  }

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

  return {
    datasources,
    sliceEntities: { ...initSliceEntities, slices, isLoading: false },
    charts: chartQueries,
    // read-only data
    dashboardInfo: {
      id: dashboard.id,
      slug: dashboard.slug,
      metadata: {
        filter_immune_slice_fields:
          dashboard.metadata.filter_immune_slice_fields,
        filter_immune_slices: dashboard.metadata.filter_immune_slices,
        timed_refresh_immune_slices:
          dashboard.metadata.timed_refresh_immune_slices,
      },
      userId: user_id,
      dash_edit_perm: dashboard.dash_edit_perm,
      dash_save_perm: dashboard.dash_save_perm,
      superset_can_explore: dashboard.superset_can_explore,
      slice_can_edit: dashboard.slice_can_edit,
      common: {
        flash_messages: common.flash_messages,
        conf: common.conf,
      },
    },
    dashboardState: {
      sliceIds: Array.from(sliceIds),
      refresh: false,
      filters,
      expandedSlices: dashboard.metadata.expanded_slices || {},
      css: dashboard.css || '',
      editMode: dashboard.dash_edit_perm && editMode,
      showBuilderPane: dashboard.dash_edit_perm && editMode,
      hasUnsavedChanges: false,
      maxUndoHistoryExceeded: false,
    },
    dashboardLayout,
    messageToasts: [],
    impressionId: shortid.generate(),
  };
}
