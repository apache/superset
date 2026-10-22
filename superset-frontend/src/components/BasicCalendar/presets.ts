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
import { t } from '@apache-superset/core/translation';
import { NO_TIME_RANGE } from '@superset-ui/core';
import { DatePickerMode } from './utils';

/** Quick ranges stay relative; only the visible input values are resolved. */
export const getQuickRanges = (mode: DatePickerMode) =>
  mode === 'datetime'
    ? [
        { value: 'Last 15 minutes', label: t('Last 15 minutes') },
        { value: 'Last 30 minutes', label: t('Last 30 minutes') },
        { value: 'Last hour', label: t('Last hour') },
        { value: 'Last 4 hours', label: t('Last 4 hours') },
        { value: 'Last 8 hours', label: t('Last 8 hours') },
        { value: 'Last 12 hours', label: t('Last 12 hours') },
        { value: 'Last 24 hours', label: t('Last 24 hours') },
      ]
    : [
        { value: 'Current day', label: t('Today') },
        { value: 'yesterday : today', label: t('Yesterday') },
        { value: 'Current week', label: t('This week') },
        { value: 'Last day', label: t('Last day') },
        { value: 'Last week', label: t('Last 7 days') },
        { value: 'Last 30 days', label: t('Last 30 days') },
        { value: 'Last month', label: t('Last month') },
        { value: 'Last quarter', label: t('Last quarter') },
        { value: 'Last year', label: t('Last year') },
        { value: 'Current month', label: t('This month') },
        { value: 'previous calendar month', label: t('Previous month') },
        { value: NO_TIME_RANGE, label: t('All time') },
      ];

export const isQuickRange = (value: string, mode: DatePickerMode) =>
  getQuickRanges(mode).some(preset => preset.value === value);
