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
import {
  CHART_TYPE,
  MARKDOWN_TYPE,
  COLUMN_TYPE,
  DIVIDER_TYPE,
  HEADER_TYPE,
  ROW_TYPE,
  TAB_TYPE,
  TABS_TYPE,
  DYNAMIC_TYPE,
  IKI_TABLE_TYPE,
  IKI_PROCESS_BUILDER_TYPE,
  IKI_RUN_PIPELINE_TYPE,
  IKI_DEEPCAST_TYPE,
  IKI_EITL_ROW_TYPE,
  IKI_EITL_COLUMN_TYPE,
  IKI_MODEL_METRICS_TYPE,
  IKI_FORECAST_TYPE,
  IKI_EXTERNAL_DATASETS_TYPE,
  IKI_EXPLAINABILITY_TYPE,
  IKI_FORECAST_MODULE_TYPE,
  IKI_DATASET_DOWNLOAD_TYPE,
  IKI_DYNAMIC_MARKDOWN_TYPE,
} from '../../util/componentTypes';

import ChartHolder from './ChartHolder';
import Markdown from './Markdown';
import Column from './Column';
import Divider from './Divider';
import Header from './Header';
import Row from './Row';
import Tab from './Tab';
import TabsConnected from './Tabs';
import DynamicComponent from './DynamicComponent';
import IkiDynamicMarkdown from './IkiDynamicMarkdown';
import IkiTable from './IkiTable';
import IkiProcessBuilder from './IkiProcessBuilder';
import IkiRunPipeline from './IkiRunPipeline';
import IkiDeepcast from './IkiDeepcast';
import IkiEitlRow from './IkiEitlRow';
import IkiEitlColumn from './IkiEitlColumn';
import IkiModelMetrics from './IkiModelMetrics';
import IkiExternalDatasets from './IkiExternalDatasets';
import IkiForecast from './IkiForecast';
import IkiExplainability from './IkiExplainability';
import IkiForecastModule from './IkiForecastModule';
import IkiDatasetDownload from './IkiDatasetDownload';

export { default as ChartHolder } from './ChartHolder';
export { default as Markdown } from './Markdown';
export { default as Column } from './Column';
export { default as Divider } from './Divider';
export { default as Header } from './Header';
export { default as Row } from './Row';
export { default as Tab } from './Tab';
export { default as Tabs } from './Tabs';
export { default as DynamicComponent } from './DynamicComponent';
export { default as IkiTable } from './IkiTable';
export { default as IkiProcessBuilder } from './IkiProcessBuilder';
export { default as IkiRunPipeline } from './IkiRunPipeline';
export { default as IkiDeepcast } from './IkiDeepcast';
export { default as IkiEitlRow } from './IkiEitlRow';
export { default as IkiEitlColumn } from './IkiEitlColumn';
export { default as IkiModelMetrics } from './IkiModelMetrics';
export { default as IkiExternalDatasets } from './IkiExternalDatasets';
export { default as IkiForecast } from './IkiForecast';
export { default as IkiExplainability } from './IkiExplainability';
export { default as IkiForecastModule } from './IkiForecastModule';
export { default as IkiDatasetDownload } from './IkiDatasetDownload';

export const componentLookup = {
  [CHART_TYPE]: ChartHolder,
  [MARKDOWN_TYPE]: Markdown,
  [COLUMN_TYPE]: Column,
  [DIVIDER_TYPE]: Divider,
  [HEADER_TYPE]: Header,
  [ROW_TYPE]: Row,
  [TAB_TYPE]: Tab,
  [TABS_TYPE]: TabsConnected,
  [DYNAMIC_TYPE]: DynamicComponent,
  [IKI_DYNAMIC_MARKDOWN_TYPE]: IkiDynamicMarkdown,
  [IKI_TABLE_TYPE]: IkiTable,
  [IKI_PROCESS_BUILDER_TYPE]: IkiProcessBuilder,
  [IKI_RUN_PIPELINE_TYPE]: IkiRunPipeline,
  [IKI_DEEPCAST_TYPE]: IkiDeepcast,
  [IKI_EITL_ROW_TYPE]: IkiEitlRow,
  [IKI_EITL_COLUMN_TYPE]: IkiEitlColumn,
  [IKI_MODEL_METRICS_TYPE]: IkiModelMetrics,
  [IKI_FORECAST_TYPE]: IkiForecast,
  [IKI_EXTERNAL_DATASETS_TYPE]: IkiExternalDatasets,
  [IKI_EXPLAINABILITY_TYPE]: IkiExplainability,
  [IKI_FORECAST_MODULE_TYPE]: IkiForecastModule,
  [IKI_DATASET_DOWNLOAD_TYPE]: IkiDatasetDownload,
};
