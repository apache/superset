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
import { createSelector } from '@reduxjs/toolkit';
import { RootState } from 'src/dashboard/types';
import { ChartCustomizationItem } from './types';

const EMPTY_ARRAY: ChartCustomizationItem[] = [];

export const selectChartCustomizationItems = createSelector(
  (state: RootState) => state.dashboardInfo.metadata,
  (metadata): ChartCustomizationItem[] => {
    if (
      metadata?.chart_customization_config &&
      metadata.chart_customization_config.length > 0
    ) {
      return metadata.chart_customization_config;
    }

    const legacyCustomization = metadata?.native_filter_configuration?.find(
      (item: any) =>
        item.type === 'CHART_CUSTOMIZATION' &&
        item.id === 'chart_customization_groupby',
    );

    if (legacyCustomization?.chart_customization) {
      return legacyCustomization.chart_customization;
    }

    return EMPTY_ARRAY;
  },
);
