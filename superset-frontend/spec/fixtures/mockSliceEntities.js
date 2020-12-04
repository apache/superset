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
import { datasourceId } from 'spec/fixtures/mockDatasource';
import { sliceId } from './mockChartQueries';

export const filterId = 127;
export const column = 'region';

export const sliceEntitiesForChart = {
  slices: {
    [sliceId]: {
      slice_id: sliceId,
      slice_url: '/superset/explore/?form_data=%7B%22slice_id%22%3A%2018%7D',
      slice_name: 'Genders',
      form_data: {
        slice_id: sliceId,
        viz_type: 'pie',
        row_limit: 50000,
        metric: 'sum__num',
        since: '100 years ago',
        groupby: ['gender'],
        metrics: ['sum__num'],
        compare_lag: '10',
        limit: '25',
        until: 'now',
        granularity: 'ds',
        markup_type: 'markdown',
        where: '',
        compare_suffix: 'o10Y',
        datasource: datasourceId,
      },
      edit_url: `/chart/edit/${sliceId}`,
      viz_type: 'pie',
      datasource: datasourceId,
      description: null,
      description_markeddown: '',
      modified: '23 hours ago',
      changed_on: 1529453332615,
    },
  },
  isLoading: false,
  errorMessage: null,
  lastUpdated: 0,
};

export const sliceEntitiesForDashboard = {
  slices: {
    [filterId]: {
      slice_id: filterId,
      slice_url: '/superset/explore/?form_data=%7B%22slice_id%22%3A%20127%7D',
      slice_name: 'Region Filter',
      form_data: {
        instant_filtering: true,
        filter_configs: [
          {
            asc: true,
            clearable: true,
            column,
            key: 'JknLrSlNL',
            multiple: true,
            label: column,
          },
        ],
      },
      edit_url: '/chart/edit/127',
      viz_type: 'filter_box',
      datasource: '2__table',
      description: null,
      description_markeddown: '',
      modified: '23 hours ago',
      changed_on: 1529453332615,
    },
    128: {
      slice_id: 128,
      slice_url: '/superset/explore/?form_data=%7B%22slice_id%22%3A%20128%7D',
      slice_name: "World's Population",
      form_data: {},
      edit_url: '/chart/edit/128',
      viz_type: 'big_number',
      datasource: '2__table',
      description: null,
      description_markeddown: '',
      modified: '23 hours ago',
      changed_on: 1529453332628,
    },
    129: {
      slice_id: 129,
      slice_url: '/superset/explore/?form_data=%7B%22slice_id%22%3A%20129%7D',
      slice_name: 'Most Populated Countries',
      form_data: {},
      edit_url: '/chart/edit/129',
      viz_type: 'table',
      datasource: '2__table',
      description: null,
      description_markeddown: '',
      modified: '23 hours ago',
      changed_on: 1529453332637,
    },
    130: {
      slice_id: 130,
      slice_url: '/superset/explore/?form_data=%7B%22slice_id%22%3A%20130%7D',
      slice_name: 'Growth Rate',
      form_data: {},
      edit_url: '/chart/edit/130',
      viz_type: 'line',
      datasource: '2__table',
      description: null,
      description_markeddown: '',
      modified: '23 hours ago',
      changed_on: 1529453332645,
    },
    131: {
      slice_id: 131,
      slice_url: '/superset/explore/?form_data=%7B%22slice_id%22%3A%20131%7D',
      slice_name: '% Rural',
      form_data: {},
      edit_url: '/chart/edit/131',
      viz_type: 'world_map',
      datasource: '2__table',
      description: null,
      description_markeddown: '',
      modified: '23 hours ago',
      changed_on: 1529453332654,
    },
    132: {
      slice_id: 132,
      slice_url: '/superset/explore/?form_data=%7B%22slice_id%22%3A%20132%7D',
      slice_name: 'Life Expectancy VS Rural %',
      form_data: {},
      edit_url: '/chart/edit/132',
      viz_type: 'bubble',
      datasource: '2__table',
      description: null,
      description_markeddown: '',
      modified: '23 hours ago',
      changed_on: 1529453332663,
    },
    133: {
      slice_id: 133,
      slice_url: '/superset/explore/?form_data=%7B%22slice_id%22%3A%20133%7D',
      slice_name: 'Rural Breakdown',
      form_data: {},
      edit_url: '/chart/edit/133',
      viz_type: 'sunburst',
      datasource: '2__table',
      description: null,
      description_markeddown: '',
      modified: '23 hours ago',
      changed_on: 1529453332673,
    },
    134: {
      slice_id: 134,
      slice_url: '/superset/explore/?form_data=%7B%22slice_id%22%3A%20134%7D',
      slice_name: "World's Pop Growth",
      form_data: {},
      edit_url: '/chart/edit/134',
      viz_type: 'area',
      datasource: '2__table',
      description: null,
      description_markeddown: '',
      modified: '23 hours ago',
      changed_on: 1529453332680,
    },
    135: {
      slice_id: 135,
      slice_url: '/superset/explore/?form_data=%7B%22slice_id%22%3A%20135%7D',
      slice_name: 'Box plot',
      form_data: {},
      edit_url: '/chart/edit/135',
      viz_type: 'box_plot',
      datasource: '2__table',
      description: null,
      description_markeddown: '',
      modified: '23 hours ago',
      changed_on: 1529453332688,
    },
    136: {
      slice_id: 136,
      slice_url: '/superset/explore/?form_data=%7B%22slice_id%22%3A%20136%7D',
      slice_name: 'Treemap',
      form_data: {},
      edit_url: '/chart/edit/136',
      viz_type: 'treemap',
      datasource: '2__table',
      description: null,
      description_markeddown: '',
      modified: '23 hours ago',
      changed_on: 1529453332700,
    },
  },
  isLoading: false,
  errorMessage: null,
  lastUpdated: 0,
};
