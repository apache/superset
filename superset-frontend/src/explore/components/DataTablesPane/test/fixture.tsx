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
import { ReactElement } from 'react';
import { DatasourceType, VizType } from '@superset-ui/core';
import { exploreActions } from 'src/explore/actions/exploreActions';
import { ChartStatus } from 'src/explore/types';
import {
  DataTablesPaneProps,
  SamplesPaneProps,
  ResultsPaneProps,
} from '../types';

const queryFormData = {
  viz_type: VizType.Heatmap,
  datasource: '34__table',
  slice_id: 456,
  url_params: {},
  time_range: 'Last week',
  all_columns_x: 'source',
  all_columns_y: 'target',
  metric: 'sum__value',
  adhoc_filters: [],
  row_limit: 10000,
  linear_color_scheme: 'blue_white_yellow',
  xscale_interval: null,
  yscale_interval: null,
  canvas_image_rendering: 'pixelated',
  normalize_across: 'heatmap',
  left_margin: 'auto',
  bottom_margin: 'auto',
  y_axis_bounds: [null, null],
  y_axis_format: 'SMART_NUMBER',
  show_perc: true,
  sort_x_axis: 'alpha_asc',
  sort_y_axis: 'alpha_asc',
  extra_form_data: {},
};

const datasource = {
  id: 34,
  name: '',
  type: DatasourceType.Table,
  columns: [],
  metrics: [],
  columnFormats: {},
  verboseMap: {},
};

export const createDataTablesPaneProps = (sliceId: number) =>
  ({
    queryFormData: {
      ...queryFormData,
      slice_id: sliceId,
    },
    datasource,
    queryForce: false,
    chartStatus: 'rendered' as ChartStatus,
    onCollapseChange: jest.fn(),
    actions: exploreActions,
    canDownload: true,
  }) as DataTablesPaneProps;

export const createSamplesPaneProps = ({
  datasourceId,
  queryForce = false,
  isRequest = true,
}: {
  datasourceId: number;
  queryForce?: boolean;
  isRequest?: boolean;
}) =>
  ({
    isRequest,
    datasource: { ...datasource, id: datasourceId },
    queryForce,
    isVisible: true,
    actions: exploreActions,
    canDownload: true,
  }) as SamplesPaneProps;

export const createResultsPaneOnDashboardProps = ({
  sliceId,
  errorMessage,
  vizType = VizType.Table,
  queryForce = false,
  isRequest = true,
}: {
  sliceId: number;
  vizType?: string;
  errorMessage?: ReactElement;
  queryForce?: boolean;
  isRequest?: boolean;
}) =>
  ({
    isRequest,
    queryFormData: {
      ...queryFormData,
      slice_id: sliceId,
      viz_type: vizType,
    },
    queryForce,
    isVisible: true,
    actions: exploreActions,
    errorMessage,
    canDownload: true,
  }) as ResultsPaneProps;
