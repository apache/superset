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
  QueryFormData,
  QueryFormMetric,
  QueryMode,
  TimeGranularity,
  TimeseriesDataRecord,
} from '@superset-ui/core';

export interface HandlebarsStylesProps {
  height: number;
  width: number;
}

interface HandlebarsCustomizeProps {
  handlebarsTemplate?: string;
  styleTemplate?: string;
}

export type HandlebarsQueryFormData = QueryFormData &
  HandlebarsStylesProps &
  HandlebarsCustomizeProps & {
    align_pn?: boolean;
    color_pn?: boolean;
    include_time?: boolean;
    include_search?: boolean;
    query_mode?: QueryMode;
    page_length?: string | number | null; // null means auto-paginate
    metrics?: QueryFormMetric[] | null;
    percent_metrics?: QueryFormMetric[] | null;
    timeseries_limit_metric?: QueryFormMetric[] | QueryFormMetric | null;
    groupby?: QueryFormMetric[] | null;
    all_columns?: QueryFormMetric[] | null;
    order_desc?: boolean;
    table_timestamp_format?: string;
    granularitySqla?: string;
    time_grain_sqla?: TimeGranularity;
  };

export type HandlebarsProps = HandlebarsStylesProps &
  HandlebarsCustomizeProps & {
    data: TimeseriesDataRecord[];
    // add typing here for the props you pass in from transformProps.ts!
    formData: HandlebarsQueryFormData;
  };
