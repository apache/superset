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

import { ChartProps } from '@superset-ui/core';
import { TopBannerChartProps, TopBannerFormData } from './types.js';
import { useTheme } from '@apache-superset/core/theme';



function numberValue(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function textValue(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

export default function transformProps(
  chartProps: ChartProps<TopBannerFormData>,
): TopBannerChartProps {
  const { width, height, formData } = chartProps;
  const theme = useTheme();

  return {
    width,
    height,
    bannerTitle: textValue(formData.bannerTitle, 'Hello'),
    bannerSubtitle: textValue(formData.bannerSubtitle, 'Typing your subtitle here...'),
    bannerIcon: textValue(formData.bannerIcon, '😶‍🌫️'),
    showIcon: formData.showIcon ?? true,
    showClock: formData.showClock ?? true,
    clockPosition: formData.clockPosition ?? 'right',
    timezone: textValue(formData.timezone, 'America/Los_Angeles').trim() || 'America/Los_Angeles',
    locale: textValue(formData.locale, 'en-GB').trim() || 'en-GB',
    datePattern: formData.datePattern ?? 'weekday',
    showDate: formData.showDate ?? true,
    showSeconds: formData.showSeconds ?? true,
    use24Hour: formData.use24Hour ?? true,
    titleFontSize: numberValue(formData.titleFontSize, 28, 12, 96),
    subtitleFontSize: numberValue(formData.subtitleFontSize, 14, 8, 48),
    clockFontSize: numberValue(formData.clockFontSize, 30, 12, 96),
    iconFontSize: numberValue(formData.iconFontSize, 28, 12, 72),
    horizontalPadding: numberValue(formData.horizontalPadding, 24, 0, 100),
    verticalPadding: numberValue(formData.verticalPadding, 14, 0, 100),
    borderRadius: numberValue(formData.borderRadius, 8, 0, 50),
    backgroundColor: textValue(formData.backgroundColor, 'transparent'),
    titleColor: textValue(formData.titleColor, 'inherit'),
    subtitleColor: textValue(formData.subtitleColor, theme.colorTextLightSolid),
    clockColor: textValue(formData.clockColor, 'inherit'),
    accentColor: textValue(formData.accentColor, theme.colorPrimary),
    showBottomBorder: formData.showBottomBorder ?? true,
  };
}
