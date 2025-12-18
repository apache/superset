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

export const WHAT_IF_PANEL_WIDTH = 340;

export const SLIDER_MIN = -50;
export const SLIDER_MAX = 50;
export const SLIDER_DEFAULT = 0;

// Static slider marks - defined at module level to avoid recreation
export const SLIDER_MARKS: Record<number, string> = {
  [SLIDER_MIN]: `${SLIDER_MIN}%`,
  0: '0%',
  [SLIDER_MAX]: `+${SLIDER_MAX}%`,
};

// Static tooltip formatter - defined at module level for stable reference
export const sliderTooltipFormatter = (value?: number): string =>
  value !== undefined ? `${value > 0 ? '+' : ''}${value}%` : '';

// Memoized tooltip config object to prevent Slider re-renders
export const SLIDER_TOOLTIP_CONFIG = { formatter: sliderTooltipFormatter };
