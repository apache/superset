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
import { DataRecord, DataRecordValue } from '@superset-ui/chart';
import { EchartsProps } from '../types';

export type TimestampType = string | number | Date;

export interface TimeseriesDataRecord extends DataRecord {
  __timestamp: TimestampType;
}

export type EchartsBaseTimeseriesSeries = {
  name: string;
  data: [Date, DataRecordValue][];
};

export type EchartsTimeseriesSeries = EchartsBaseTimeseriesSeries & {
  color: string;
  stack?: string;
  type: 'bar' | 'line';
  smooth: boolean;
  step?: 'start' | 'middle' | 'end';
  areaStyle: {
    opacity: number;
  };
  symbolSize: number;
};

export type EchartsTimeseriesProps = EchartsProps & {
  area: number;
  colorScheme: string;
  contributionMode?: string;
  zoomable?: boolean;
  seriesType: string;
  logAxis: boolean;
  stack: boolean;
  markerEnabled: boolean;
  markerSize: number;
  minorSplitLine: boolean;
  opacity: number;
};
