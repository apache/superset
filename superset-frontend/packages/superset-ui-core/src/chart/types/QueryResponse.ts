/*
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

/**
 * Types for query response
 */
import {
  DataRecordValue,
  DataRecord,
  ChartDataResponseResult,
} from '../../types';
import { PlainObject } from './Base';

export interface TimeseriesDataRecord extends DataRecord {
  __timestamp: number | string | Date | null;
}

// data record value filters from FilterBox
export interface DataRecordFilters {
  [key: string]: DataRecordValue[];
}

/**
 * Legacy queried data for charts. List of arbitrary dictionaries generated
 * by `viz.py`.
 * TODO: clean this up when all charts have been migrated to v1 API.
 */
export type LegacyQueryData = PlainObject;

/**
 * Ambiguous query data type. Reserved for the generic QueryFormData.
 * Don't use this for a specific chart (since you know which API it uses already).
 */
export type QueryData = LegacyQueryData | ChartDataResponseResult;

export default {};
