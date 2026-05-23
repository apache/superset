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
import {
    QueryFormData,
    TimeseriesDataRecord,
    ChartProps,
} from '@superset-ui/core';
import { SupersetTheme } from '@apache-superset/core/theme';


export interface SupersetPluginChartCustomControlsStylesProps {
    height: number;
    width: number;
}


export type ControlType = 'Dropdown' | 'Radio' | 'Checkbox' | 'TextBox';


export interface SupersetPluginChartCustomControlsQueryFormData extends QueryFormData {
    controlType: ControlType;
    filterColumn?: any;
    orientation?: 'vertical' | 'horizontal';
    includeAllOption?: boolean;
    multiSelect?: boolean;
    defaultValue?: string;
    hideTitle?: boolean;
    boldTitle?: boolean;
}


export interface ExtendedTheme extends SupersetTheme {}


export interface SupersetPluginChartCustomControlsProps extends SupersetPluginChartCustomControlsStylesProps {
    data: TimeseriesDataRecord[];
    controlType: ControlType;
    filterColumn?: any;
    orientation?: 'vertical' | 'horizontal';
    includeAllOption?: boolean;
    multiSelect?: boolean;
    defaultValue?: string;
    hideTitle?: boolean;
    boldTitle?: boolean;
    hooks: ChartProps['hooks'];
    filterState?: any;
    theme?: ExtendedTheme;
}


export type CustomControlsTransformedProps = SupersetPluginChartCustomControlsProps;
