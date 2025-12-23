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

/**
 * Timeseries-specific: DataZoom configuration
 * Used by charts with axes (timeseries, bar, etc.)
 */

import PTM_THEME from '../../../shared/ptmTheme';

type PtmZoomAxis = 'x' | 'y' | 'both';
type PtmZoomSize = 'xs' | 'sm';

export interface DataZoomConfig {
  dataZoom?: unknown[];
  toolbox?: Record<string, unknown>;
  grid?: Record<string, unknown>;
}


export function getThemeDataZoom(formData: Record<string, unknown>): DataZoomConfig {
  const enabled = (formData.ptmZoomEnabled as boolean | undefined) ?? false;
  
  if (!enabled) {
    return { 
      dataZoom: [],
      toolbox: { show: false }
    };
  }

  const axis = (formData.ptmZoomAxis as PtmZoomAxis | undefined) ?? 'x';
  const size = (formData.ptmZoomSize as PtmZoomSize | undefined) ?? 'xs';

  const insetRaw = formData.ptmZoomInset as string | number | undefined;
  const inset = typeof insetRaw === 'number' ? insetRaw : Number(insetRaw ?? 24);

  const make = (axisType: 'x' | 'y') => {
    const dz = PTM_THEME.echarts.dataZoom.create(axisType, size, inset);
    return [dz.slider, dz.inside];
  };

  const result: DataZoomConfig = {};
  
  if (axis === 'both') {
    result.dataZoom = [...make('x'), ...make('y')];
    result.grid = {
      right: 40,
    };
  } else if (axis === 'y') {
    result.dataZoom = make('y');
    result.grid = {
      right: 40,
    };
  } else {
    result.dataZoom = make('x');
  }
  
  result.toolbox = { show: false };
  
  return result;
}

