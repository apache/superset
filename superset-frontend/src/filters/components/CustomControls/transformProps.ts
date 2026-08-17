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
import { ChartProps, TimeseriesDataRecord } from '@superset-ui/core';
import {
  CustomControlsTransformedProps,
  PluginFilterCustomControlsQueryFormData,
} from './types';

export default function transformProps(
  chartProps: ChartProps,
): CustomControlsTransformedProps {
  const {
    width,
    height,
    formData = {},
    queriesData,
    hooks = {},
    filterState,
    displaySettings,
    theme,
  } = chartProps;
  const { setDataMask = () => {} } = hooks;

  const customControlsFormData =
    formData as PluginFilterCustomControlsQueryFormData;
  const controlValues =
    (customControlsFormData.controlValues as Record<string, unknown>) || {};

  const rawGroupby = (formData as Record<string, unknown>).groupby;
  const groupbyCol = Array.isArray(rawGroupby) ? rawGroupby[0] : rawGroupby;

  const filterColumn =
    (formData.targets as Array<{ column?: { name?: string } }>)?.[0]?.column
      ?.name ||
    (typeof groupbyCol === 'string' ? groupbyCol : undefined) ||
    customControlsFormData.filterColumn ||
    (controlValues.filterColumn as string | undefined) ||
    (controlValues.groupby as string | undefined) ||
    (formData.columns as string[])?.[0];

  let data: TimeseriesDataRecord[] = [];
  if (
    Array.isArray(queriesData) &&
    queriesData.length > 0 &&
    queriesData[0]?.data
  ) {
    data = (queriesData[0].data as TimeseriesDataRecord[]) || [];
  } else {
    const { data: chartData } = chartProps as unknown as {
      data?: TimeseriesDataRecord[];
    };
    if (Array.isArray(chartData)) {
      data = chartData;
    }
  }

  const inCanvas = Boolean(
    customControlsFormData.inCanvas ||
    (displaySettings as { inCanvas?: boolean } | undefined)?.inCanvas ||
    (chartProps as unknown as { inCanvas?: boolean }).inCanvas,
  );

  return {
    width,
    height,
    data,
    controlType:
      customControlsFormData.controlType ||
      (controlValues.controlType as typeof customControlsFormData.controlType) ||
      'Dropdown',
    filterColumn,
    orientation:
      customControlsFormData.orientation ||
      (controlValues.orientation as 'vertical' | 'horizontal') ||
      'vertical',
    includeAllOption:
      customControlsFormData.includeAllOption ??
      (controlValues.includeAllOption as boolean | undefined) ??
      false,
    multiSelect:
      customControlsFormData.multiSelect ??
      (controlValues.multiSelect as boolean | undefined) ??
      true,
    inCanvas,
    filterBarOrientation: displaySettings?.filterBarOrientation,
    isOverflowingFilterBar: displaySettings?.isOverflowingFilterBar,
    setDataMask,
    filterState,
    theme,
  };
}
