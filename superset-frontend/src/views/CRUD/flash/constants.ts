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
  { label: 'Materialized Failed', value: 'Materialized_Failed' },
  { label: 'Updated', value: 'Updated' },
  { label: 'Deleted', value: 'Deleted' },
  { label: 'Marked For Deletion', value: 'MarkedForDeletion' },
];

export const UPDATE_TYPES = {
  SQL: 'sql',
  TTL: 'ttl',
  FLASHTYPE: 'flashType',
  SCHEDULE: 'schedule',
  OWNER: 'owner',
  CTAGS: 'ctags',
};

export const DATASOURCE_TYPES = {
  HIVE: 'hive',
  PINOT: 'pinot',
};

export const ERROR_MESSSAGES = {
  REMOTE_SERVER:
    'Unable to connect with the remote server. Please contact your Administrator or communicate on the required Support Channel.',
};

export const FLASH_TYPE_JSON = {
  JSONSCHEMA: {
    type: 'object',
    properties: {
      flashType: {
        title: 'Flash Type',
        type: 'string',
        enum: ['', 'One Time', 'Short Term', 'Long Term'],
        enumNames: [
          'Please Select',
          'One Time (Valid upto 7 days)',
          'Short Term (Valid upto 7 days)',
          'Long Term (Valid upto 90 days)',
        ],
        default: 'Please Select',
      },
    },
    required: ['flashType'],
    dependencies: {
      flashType: {
        oneOf: [
          {
            properties: {
              flashType: { enum: ['Long Term'] },
              teamSlackChannel: {
                type: 'string',
                title: 'Slack Channel',
                pattern: '^(#)[A-Za-z0-9_-]+$',
              },
              teamSlackHandle: {
                type: 'string',
                title: 'Slack Handle',
                pattern: '^(@)[A-Za-z0-9_-\\s]+$',
              },
              scheduleType: {
                title: 'Schedule Type',
                type: 'string',
                enum: ['', 'Hourly', 'Daily', 'Weekly', 'Monthly'],
                enumNames: [
                  'Please Select',
                  'Hourly',
                  'Daily',
                  'Weekly',
                  'Monthly',
                ],
                default: 'Please Select',
              },
              scheduleStartTime: {
                type: 'string',
                title: 'Schedule Start Time (In UTC)',
                format: 'date-time',
              },
            },
            required: [
              'teamSlackChannel',
              'teamSlackHandle',
              'scheduleType',
              'scheduleStartTime',
            ],
          },
          {
            properties: {
              flashType: { enum: ['Short Term'] },
              scheduleType: {
                title: 'Schedule Type',
                type: 'string',
                enum: ['', 'Hourly', 'Daily', 'Weekly', 'Monthly'],
                enumNames: [
                  'Please Select',
                  'Hourly',
                  'Daily',
                  'Weekly',
                  'Monthly',
                ],
                default: 'Please Select',
              },
              scheduleStartTime: {
                type: 'string',
                title: 'Schedule Start Time (In UTC)',
                format: 'date-time',
              },
            },
            required: ['scheduleType', 'scheduleStartTime'],
          },
        ],
      },
    },
  },
  UISCHEMA: {
    'ui:order': ['flashType', '*'],
    teamSlackChannel: {
      'ui:placeholder': '#slack_channel_name',
      'ui:help': 'Slack channel for notification',
    },
    teamSlackHandle: {
      'ui:placeholder': '@slack_handle_name',
      'ui:help': 'Slack handle for notification',
    },
    scheduleType: { 'ui:help': 'Schedule type for the Flash object' },
    scheduleStartTime: {
      'ui:help': 'Start time from which the flash object is to be scheduled.',
    },
  },
  VALIDATION: [],
};
