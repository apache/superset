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

import { FilterDropdown } from './types';

export const FLASH_TYPES: FilterDropdown[] = [
  { label: 'One Time', value: 'One Time' },
  { label: 'Short Term', value: 'Short Term' },
  { label: 'Long Term', value: 'Long Term' },
];

export const SCHEDULE_TYPE: FilterDropdown[] = [
  { label: 'Hourly', value: 'Hourly' },
  { label: 'Daily', value: 'Daily' },
  { label: 'Weekly', value: 'Weekly' },
  { label: 'Monthly', value: 'Monthly' },
];

export const DATABASES: FilterDropdown[] = [
  { label: 'Pinot Flashes', value: 'Pinot Flashes' },
];

export const FLASH_STATUS: FilterDropdown[] = [
  { label: 'New', value: 'New' },
  { label: 'In Progress', value: 'InProgress' },
  { label: 'Materialized', value: 'Materialized' },
  { label: 'Stale', value: 'Stale' },
  { label: 'Deleted', value: 'Deleted' },
  { label: 'Marked For Deletion', value: 'MarkedForDeletion' },
];

export const UPDATE_TYPES = {
  SQL: 'sql',
  TTL: 'ttl',
  SCHEDULE: 'schedule',
  OWNER: 'owner',
  CTAGS: 'ctags',
};

export const DATASOURCE_TYPES = {
  HIVE: 'hive',
  PINOT: 'pinot',
};
