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

import { ChartProps, QueryFormData } from '@superset-ui/core';

export type DatePattern = 'weekday' | 'short' | 'medium' | 'long' | 'full';
export type ClockPosition = 'left' | 'right';

export interface TopBannerFormData extends QueryFormData {
  bannerTitle?: string;
  bannerSubtitle?: string;
  bannerIcon?: string;
  showIcon?: boolean;
  showClock?: boolean;
  clockPosition?: ClockPosition;
  timezone?: string;
  locale?: string;
  datePattern?: DatePattern;
  showDate?: boolean;
  showSeconds?: boolean;
  use24Hour?: boolean;
  titleFontSize?: number;
  subtitleFontSize?: number;
  clockFontSize?: number;
  iconFontSize?: number;
  horizontalPadding?: number;
  verticalPadding?: number;
  borderRadius?: number;
  backgroundColor?: string;
  titleColor?: string;
  subtitleColor?: string;
  clockColor?: string;
  accentColor?: string;
  showBottomBorder?: boolean;
}

export interface TopBannerChartProps {
  width: number;
  height: number;
  bannerTitle: string;
  bannerSubtitle: string;
  bannerIcon: string;
  showIcon: boolean;
  showClock: boolean;
  clockPosition: ClockPosition;
  timezone: string;
  locale: string;
  datePattern: DatePattern;
  showDate: boolean;
  showSeconds: boolean;
  use24Hour: boolean;
  titleFontSize: number;
  subtitleFontSize: number;
  clockFontSize: number;
  iconFontSize: number;
  horizontalPadding: number;
  verticalPadding: number;
  borderRadius: number;
  backgroundColor: string;
  titleColor: string;
  subtitleColor: string;
  clockColor: string;
  accentColor: string;
  showBottomBorder: boolean;
}

export type TopBannerChartPropsFromSuperset = ChartProps<TopBannerFormData>;
