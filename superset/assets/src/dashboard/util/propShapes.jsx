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
import PropTypes from 'prop-types';
import componentTypes from './componentTypes';
import backgroundStyleOptions from './backgroundStyleOptions';
import headerStyleOptions from './headerStyleOptions';

export const componentShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  type: PropTypes.oneOf(Object.values(componentTypes)).isRequired,
  parents: PropTypes.arrayOf(PropTypes.string),
  children: PropTypes.arrayOf(PropTypes.string),
  meta: PropTypes.shape({
    // Dimensions
    width: PropTypes.number,
    height: PropTypes.number,

    // Header
    headerSize: PropTypes.oneOf(headerStyleOptions.map(opt => opt.value)),

    // Row
    background: PropTypes.oneOf(backgroundStyleOptions.map(opt => opt.value)),

    // Chart
    chartId: PropTypes.number,
  }),
});

export const chartPropShape = PropTypes.shape({
  id: PropTypes.number.isRequired,
  chartAlert: PropTypes.string,
  chartStatus: PropTypes.string,
  chartUpdateEndTime: PropTypes.number,
  chartUpdateStartTime: PropTypes.number,
  latestQueryFormData: PropTypes.object,
  queryController: PropTypes.shape({ abort: PropTypes.func }),
  queryResponse: PropTypes.object,
  triggerQuery: PropTypes.bool,
  lastRendered: PropTypes.number,
});

export const slicePropShape = PropTypes.shape({
  slice_id: PropTypes.number.isRequired,
  slice_url: PropTypes.string.isRequired,
  slice_name: PropTypes.string.isRequired,
  edit_url: PropTypes.string.isRequired,
  datasource: PropTypes.string,
  datasource_name: PropTypes.string,
  datasource_link: PropTypes.string,
  changed_on: PropTypes.number.isRequired,
  modified: PropTypes.string.isRequired,
  viz_type: PropTypes.string.isRequired,
  description: PropTypes.string,
  description_markeddown: PropTypes.string,
});

export const filterIndicatorPropShape = PropTypes.shape({
  chartId: PropTypes.number.isRequired,
  colorCode: PropTypes.string.isRequired,
  componentId: PropTypes.string.isRequired,
  directPathToFilter: PropTypes.arrayOf(PropTypes.string).isRequired,
  isDateFilter: PropTypes.bool.isRequired,
  isFilterFieldActive: PropTypes.bool.isRequired,
  isInstantFilter: PropTypes.bool.isRequired,
  label: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  values: PropTypes.array.isRequired,
});

export const dashboardFilterPropShape = PropTypes.shape({
  chartId: PropTypes.number.isRequired,
  componentId: PropTypes.string.isRequired,
  filterName: PropTypes.string.isRequired,
  directPathToFilter: PropTypes.arrayOf(PropTypes.string).isRequired,
  isDateFilter: PropTypes.bool.isRequired,
  isInstantFilter: PropTypes.bool.isRequired,
  columns: PropTypes.object,
  labels: PropTypes.object,
  scopes: PropTypes.object,
});

export const dashboardStatePropShape = PropTypes.shape({
  sliceIds: PropTypes.arrayOf(PropTypes.number).isRequired,
  expandedSlices: PropTypes.object,
  editMode: PropTypes.bool,
  isPublished: PropTypes.bool.isRequired,
  builderPaneType: PropTypes.string.isRequired,
  colorNamespace: PropTypes.string,
  colorScheme: PropTypes.string,
  updatedColorScheme: PropTypes.bool,
  hasUnsavedChanges: PropTypes.bool,
});

export const dashboardInfoPropShape = PropTypes.shape({
  id: PropTypes.number.isRequired,
  metadata: PropTypes.object,
  slug: PropTypes.string,
  dash_edit_perm: PropTypes.bool.isRequired,
  dash_save_perm: PropTypes.bool.isRequired,
  common: PropTypes.object,
  userId: PropTypes.string.isRequired,
});

/* eslint-disable-next-line  no-undef */
const lazyFunction = f => () => f().apply(this, arguments);

const leafType = PropTypes.shape({
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  label: PropTypes.string.isRequired,
});

const parentShape = {
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  label: PropTypes.string.isRequired,
  children: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.shape(lazyFunction(() => parentShape)),
      leafType,
    ]),
  ),
};

export const filterScopeSelectorTreeNodePropShape = PropTypes.oneOfType([
  PropTypes.shape(parentShape),
  leafType,
]);
