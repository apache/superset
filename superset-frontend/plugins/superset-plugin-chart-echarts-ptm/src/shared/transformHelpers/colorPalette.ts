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
 * software distributed under this License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import { PTM_COLOR_PALETTES, PtmColorPalette } from '../ptmTheme';

type PtmColorOrder = 'normal' | 'reverse' | 'light-to-dark' | 'dark-to-light';


function calculateLuminance(color: string): number {
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}


function sortColorsByLuminance(colors: string[], ascending: boolean): string[] {
  const withLuminance = colors.map(color => ({
    color,
    luminance: calculateLuminance(color),
  }));
  
  withLuminance.sort((a, b) => 
    ascending ? a.luminance - b.luminance : b.luminance - a.luminance
  );
  
  return withLuminance.map(item => item.color);
}


export function getColorPalette(formData: Record<string, unknown>): { color: string[] } {
  const paletteName = (formData.ptmColorPalette as PtmColorPalette | undefined) ?? 'blue';
  const colorOrder = (formData.ptmColorOrder as PtmColorOrder | undefined) ?? 'normal';
  const palette = PTM_COLOR_PALETTES[paletteName];
  
  if (!palette) {
    console.warn(`[PTM] Unknown color palette: ${paletteName}, falling back to blue`);
    return { color: [...PTM_COLOR_PALETTES.blue.colors] };
  }
  
  let colors: string[] = [...palette.colors];
  
  switch (colorOrder) {
    case 'reverse':
      colors = colors.reverse();
      break;
    case 'light-to-dark':
      colors = sortColorsByLuminance(colors, true);
      break;
    case 'dark-to-light':
      colors = sortColorsByLuminance(colors, false);
      break;
    default:
      break;
  }
  
  return { color: colors };
}

export function cleanSeriesColors(
  series: Record<string, unknown>[],
): Record<string, unknown>[] {
  return series.map((s: any) => {
    const cleanedSeries = { ...s };
    
    if (cleanedSeries.itemStyle?.color) {
      const { color, ...restItemStyle } = cleanedSeries.itemStyle;
      cleanedSeries.itemStyle = Object.keys(restItemStyle).length > 0 ? restItemStyle : undefined;
    }
    
    if (Array.isArray(cleanedSeries.data)) {
      let hasDataColors = false;
      cleanedSeries.data = cleanedSeries.data.map((dataItem: any) => {
        if (dataItem?.itemStyle?.color) {
          hasDataColors = true;
          const { color, ...restItemStyle } = dataItem.itemStyle;
          return {
            ...dataItem,
            itemStyle: Object.keys(restItemStyle).length > 0 ? restItemStyle : undefined,
          };
        }
        return dataItem;
      });
    }
    
    return cleanedSeries;
  });
}

interface EchartOptions {
  series?: Record<string, unknown>[];
  color?: string[];
  [key: string]: unknown;
}

export function applyColorPalette(
  options: EchartOptions,
  formData: Record<string, unknown>,
): EchartOptions {
  const colorPaletteOverrides = getColorPalette(formData);
  
  if (!colorPaletteOverrides.color || colorPaletteOverrides.color.length === 0) {
    return options;
  }
  
  const result = { ...options };
  result.color = colorPaletteOverrides.color;
  
  if (Array.isArray(result.series)) {
    result.series = cleanSeriesColors(result.series);
  }

  return result;
}

