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
import { CustomControlsTransformedProps, SupersetPluginChartCustomControlsQueryFormData } from '../types';


export default function transformProps(chartProps: ChartProps): CustomControlsTransformedProps {
    const { width, height, formData, queriesData, hooks, filterState } = chartProps;
    const theme = (chartProps as any).theme;


    const customControlsFormData = formData as SupersetPluginChartCustomControlsQueryFormData;
    const data = Array.isArray(queriesData) && queriesData.length > 0
        ? (queriesData[0].data as TimeseriesDataRecord[]) || []
        : [];


    return {
        width,
        height,
        data,
        controlType: customControlsFormData.controlType || 'Dropdown',
        filterColumn: customControlsFormData.filterColumn,
        orientation: customControlsFormData.orientation || 'vertical',
        includeAllOption: customControlsFormData.includeAllOption || false,
        multiSelect: customControlsFormData.multiSelect ?? true,
        defaultValue: customControlsFormData.defaultValue || '',
        hideTitle: customControlsFormData.hideTitle ?? false,
        boldTitle: customControlsFormData.boldTitle ?? true,
        hooks,
        filterState,
        theme,
    };
}
