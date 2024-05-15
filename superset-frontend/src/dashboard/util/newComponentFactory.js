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
import shortid from 'shortid';
import { t } from '@superset-ui/core';

import {
  CHART_TYPE,
  COLUMN_TYPE,
  DIVIDER_TYPE,
  HEADER_TYPE,
  MARKDOWN_TYPE,
  ROW_TYPE,
  TABS_TYPE,
  TAB_TYPE,
  DYNAMIC_TYPE,
  IKI_DYNAMIC_MARKDOWN_TYPE,
  IKI_TABLE_TYPE,
  IKI_PROCESS_BUILDER_TYPE,
  IKI_RUN_PIPELINE_TYPE,
  IKI_DEEPCAST_TYPE,
  IKI_EITL_ROW_TYPE,
  IKI_EITL_COLUMN_TYPE,
  IKI_MODEL_METRICS_TYPE,
  IKI_FORECAST_TYPE,
  IKI_FORECAST_MODULE_TYPE,
  IKI_EXTERNAL_DATASETS_TYPE,
  IKI_EXPLAINABILITY_TYPE,
  IKI_DATASET_DOWNLOAD_TYPE,
} from './componentTypes';

import {
  MEDIUM_HEADER,
  BACKGROUND_TRANSPARENT,
  GRID_DEFAULT_CHART_WIDTH,
  GRID_COLUMN_COUNT,
} from './constants';

const typeToDefaultMetaData = {
  [CHART_TYPE]: { width: GRID_DEFAULT_CHART_WIDTH, height: 50 },
  [COLUMN_TYPE]: {
    width: GRID_DEFAULT_CHART_WIDTH,
    background: BACKGROUND_TRANSPARENT,
  },
  [DIVIDER_TYPE]: null,
  [HEADER_TYPE]: {
    text: 'New header',
    headerSize: MEDIUM_HEADER,
    background: BACKGROUND_TRANSPARENT,
  },
  [MARKDOWN_TYPE]: { width: GRID_DEFAULT_CHART_WIDTH, height: 50 },
  [IKI_DYNAMIC_MARKDOWN_TYPE]: { width: 12, height: 50 },
  [IKI_TABLE_TYPE]: { width: GRID_DEFAULT_CHART_WIDTH, height: 50 },
  [IKI_PROCESS_BUILDER_TYPE]: { width: GRID_DEFAULT_CHART_WIDTH, height: 50 },
  [IKI_RUN_PIPELINE_TYPE]: { width: GRID_DEFAULT_CHART_WIDTH, height: 50 },
  [IKI_DEEPCAST_TYPE]: { width: GRID_DEFAULT_CHART_WIDTH, height: 75 },
  [IKI_EITL_ROW_TYPE]: { width: GRID_DEFAULT_CHART_WIDTH, height: 50 },
  [IKI_EITL_COLUMN_TYPE]: { width: GRID_DEFAULT_CHART_WIDTH, height: 50 },
  [IKI_MODEL_METRICS_TYPE]: { width: GRID_DEFAULT_CHART_WIDTH, height: 50 },
  [IKI_DATASET_DOWNLOAD_TYPE]: { width: GRID_DEFAULT_CHART_WIDTH, height: 50 },
  [IKI_FORECAST_TYPE]: { width: GRID_DEFAULT_CHART_WIDTH, height: 98 },
  [IKI_FORECAST_MODULE_TYPE]: { width: GRID_DEFAULT_CHART_WIDTH, height: 50 },
  [IKI_EXTERNAL_DATASETS_TYPE]: { width: GRID_DEFAULT_CHART_WIDTH, height: 50 },
  [IKI_MODEL_METRICS_TYPE]: { width: GRID_DEFAULT_CHART_WIDTH, height: 50 },
  [IKI_EXPLAINABILITY_TYPE]: { width: GRID_DEFAULT_CHART_WIDTH, height: 75 },
  [ROW_TYPE]: { background: BACKGROUND_TRANSPARENT },
  [TABS_TYPE]: null,
  [TAB_TYPE]: {
    text: '',
    defaultText: t('Tab title'),
    placeholder: t('Tab title'),
  },
  [DYNAMIC_TYPE]: {
    width: GRID_COLUMN_COUNT,
    background: BACKGROUND_TRANSPARENT,
  },
};

function uuid(type) {
  return `${type}-${shortid.generate()}`;
}

export default function entityFactory(type, meta, parents = []) {
  return {
    type,
    id: uuid(type),
    children: [],
    parents,
    meta: {
      ...typeToDefaultMetaData[type],
      ...meta,
    },
  };
}
