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
import { ChartCustomizationItem, GroupByCustomization } from './types';

export function generateGroupById(): string {
  return `groupby_${Date.now()}`;
}

export const getChartCustomizationIds = (items: ChartCustomizationItem[]) =>
  items.map(item => item.id);

export const createDefaultChartCustomizationItem = (
  chartId?: number,
  defaultDatasetId?: number,
): ChartCustomizationItem => ({
  id: generateGroupById(),
  title: t('[untitled]'),
  dataset: null,
  description: '',
  removed: false,
  chartId,
  settings: {
    sortFilter: false,
    hasDefaultValue: false,
    isRequired: false,
    selectFirstByDefault: false,
  },
  customization: {
    name: '',
    dataset: defaultDatasetId ? String(defaultDatasetId) : null,
    column: null,
    sortAscending: true,
    hasDefaultValue: false,
    isRequired: false,
    selectFirst: false,
  },
});

export const ensureValidCustomization = (
  customization: Partial<GroupByCustomization> = {},
): GroupByCustomization => ({
  name: customization.name || '',
  dataset: customization.dataset || null,
  column: customization.column || null,
  ...customization,
});
