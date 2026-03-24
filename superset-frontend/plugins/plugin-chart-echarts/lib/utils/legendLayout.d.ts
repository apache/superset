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
import type { SupersetTheme } from '@apache-superset/core/theme';
import { LegendOrientation, LegendType } from '../types';
import { LegendLayoutResult } from './series';
type LegendDataItem = {
    name?: string | number | null;
} | string | number | null | undefined;
export type ResolvedLegendLayout = {
    effectiveLegendMargin?: string | number | null;
    effectiveLegendType: LegendType;
    legendLayout: LegendLayoutResult;
};
export declare function resolveLegendLayout(args: {
    availableHeight?: number;
    availableWidth?: number;
    chartHeight: number;
    chartWidth: number;
    legendItems?: LegendDataItem[];
    legendMargin?: string | number | null;
    orientation: LegendOrientation;
    show: boolean;
    showSelectors?: boolean;
    theme: SupersetTheme;
    type: LegendType;
}): ResolvedLegendLayout;
