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
  TimeseriesDataRecord,
  Metric,
  SimpleAdhocFilter,
} from '@superset-ui/core';

export type FontSizeOptions = 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl';

export interface PopKPIStylesProps {
  height: number;
  width: number;
  headerFontSize: FontSizeOptions;
  subheaderFontSize: FontSizeOptions;
  boldText: boolean;
  comparisonColorEnabled: boolean;
}

export type TableColumnConfig = {
  visible?: boolean;
  customColumnName?: string;
  displayTypeIcon?: boolean;
};

interface PopKPICustomizeProps {
  headerText: string;
}

export interface PopKPIComparisonValueStyleProps {
  subheaderFontSize?: FontSizeOptions;
}

export interface PopKPIComparisonSymbolStyleProps {
  backgroundColor: string;
  textColor: string;
}

export type PopKPIQueryFormData = QueryFormData &
  PopKPIStylesProps &
  PopKPICustomizeProps;

export type PopKPIProps = PopKPIStylesProps &
  PopKPICustomizeProps & {
    data: TimeseriesDataRecord[];
    metrics: Metric[];
    metricName: string;
    metricNameFontSize?: number;
    showMetricName: boolean;
    bigNumber: string;
    prevNumber: string;
    subtitle?: string;
    subtitleFontSize: number;
    valueDifference: string;
    percentDifferenceFormattedString: string;
    compType: string;
    percentDifferenceNumber: number;
    comparisonColorScheme?: string;
    currentTimeRangeFilter?: SimpleAdhocFilter;
    startDateOffset?: string;
    shift: string;
    dashboardTimeRange?: string;
    columnConfig?: Record<string, TableColumnConfig>;
  };

export enum ColorSchemeEnum {
  Green = 'Green',
  Red = 'Red',
}
