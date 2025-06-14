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
import { t } from '@superset-ui/core';
import type { Type } from 'src/components/Label';

export const STATE_TYPE_MAP: Record<string, Type> = {
  offline: 'danger',
  failed: 'danger',
  pending: 'info',
  fetching: 'info',
  running: 'warning',
  stopped: 'danger',
  success: 'success',
};

export const STATE_TYPE_MAP_LOCALIZED: Record<string, string> = {
  offline: t('offline'),
  failed: t('failed'),
  pending: t('pending'),
  fetching: t('fetching'),
  running: t('running'),
  stopped: t('stopped'),
  success: t('success'),
};

export const STATUS_OPTIONS = {
  success: 'success',
  failed: 'failed',
  running: 'running',
  offline: 'offline',
  pending: 'pending',
};

export const STATUS_OPTIONS_LOCALIZED = {
  success: t('success'),
  failed: t('failed'),
  running: t('running'),
  offline: t('offline'),
  pending: t('pending'),
};

export const TIME_OPTIONS = [
  'now',
  '1 hour ago',
  '1 day ago',
  '7 days ago',
  '28 days ago',
  '90 days ago',
  '1 year ago',
];

// SqlEditor layout constants
export const SQL_EDITOR_GUTTER_HEIGHT = 5;
export const SQL_EDITOR_GUTTER_MARGIN = 3;
export const SQL_TOOLBAR_HEIGHT = 51;
export const SQL_EDITOR_LEFTBAR_WIDTH = 400;
export const SQL_EDITOR_PADDING = 10;
export const INITIAL_NORTH_PERCENT = 30;
export const INITIAL_SOUTH_PERCENT = 70;
export const SET_QUERY_EDITOR_SQL_DEBOUNCE_MS = 2000;
export const VALIDATION_DEBOUNCE_MS = 600;
export const WINDOW_RESIZE_THROTTLE_MS = 100;

// kilobyte storage
export const KB_STORAGE = 1024;
export const BYTES_PER_CHAR = 2;

// browser's localStorage max usage constants
export const LOCALSTORAGE_MAX_QUERY_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
export const LOCALSTORAGE_MAX_USAGE_KB = 5 * 1024; // 5M
export const LOCALSTORAGE_MAX_QUERY_RESULTS_KB = 1 * 1024; // 1M
export const LOCALSTORAGE_WARNING_THRESHOLD = 0.9;
export const LOCALSTORAGE_WARNING_MESSAGE_THROTTLE_MS = 8000; // danger type toast duration

// autocomplete score weights
export const SQL_KEYWORD_AUTOCOMPLETE_SCORE = 100;
export const SQL_FUNCTIONS_AUTOCOMPLETE_SCORE = 90;
export const SCHEMA_AUTOCOMPLETE_SCORE = 60;
export const TABLE_AUTOCOMPLETE_SCORE = 55;
export const COLUMN_AUTOCOMPLETE_SCORE = 50;
