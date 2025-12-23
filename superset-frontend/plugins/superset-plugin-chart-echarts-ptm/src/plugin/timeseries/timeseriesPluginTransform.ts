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

import merge from 'lodash.merge';
import type { TransformConfig } from '../../shared/transformHelpers';
import { createDefaultPluginTransform } from '../../shared';
import { applySeriesTypeOverride, type PtmSeriesType } from './transformHelpers/seriesTypeOverride';
import { getThemeDataZoom } from './transformHelpers/dataZoom';
import TIMESERIES_PTM_DEFAULTS from './defaults';

interface EchartOptions {
  series?: Record<string, unknown>[];
  dataZoom?: unknown[];
  toolbox?: Record<string, unknown>;
  grid?: Record<string, unknown>;
  [key: string]: unknown;
}

export function timeseriesPluginTransform(
  options: EchartOptions,
  formData: Record<string, unknown>,
  transforms: TransformConfig,
): EchartOptions {
  const defaultTransform = createDefaultPluginTransform(TIMESERIES_PTM_DEFAULTS);
  let finalOptions = defaultTransform(options, formData, transforms);

  if (transforms.seriesType) {
    const ptmSeriesType = formData.ptmSeriesType as PtmSeriesType | undefined;
    finalOptions = applySeriesTypeOverride(finalOptions, ptmSeriesType);
  }

  if (transforms.dataZoom) {
    const themeZoomOverrides = getThemeDataZoom(formData);
    
    if (themeZoomOverrides.dataZoom !== undefined) {
      finalOptions.dataZoom = themeZoomOverrides.dataZoom;
    }
    if (themeZoomOverrides.toolbox !== undefined) {
      finalOptions.toolbox = themeZoomOverrides.toolbox;
    }
    if (themeZoomOverrides.grid !== undefined && themeZoomOverrides.grid !== null) {
      const currentGrid = finalOptions.grid && typeof finalOptions.grid === 'object' 
        ? finalOptions.grid as Record<string, unknown>
        : {};
      finalOptions.grid = merge({}, currentGrid, themeZoomOverrides.grid as Record<string, unknown>);
    }
    
  }

  return finalOptions;
}

