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

// Defaults mirror the reference ECharts option (title, big number, MoM and
// YoY comparison) so the chart renders out of the box and every fixed value
// can be overridden through the control panel.
// The title font size control is the shared Subtitle Font Size select
// (Tiny / Small / Normal / Large / Huge ratios), reused from the Big Number
// with Trendline plugin. The default is Tiny so the title stays compact on
// dashboard tiles. Ratios are multiplied by the chart height; legacy
// numeric values > 1 are treated as absolute pixels.
export const DEFAULT_TITLE_FONT_SIZE = 0.15;
export const DEFAULT_TITLE_COLOR = { r: 102, g: 102, b: 102 }; // #666
export const DEFAULT_TITLE_LEFT = 20;
export const DEFAULT_TITLE_TOP = 20;

// All font sizes use the shared 5-tier ratio selects (Tiny..Huge); ratios
// are multiplied by the chart height, matching the Big Number family.
export const DEFAULT_BIG_NUMBER_FONT_SIZE = 0.4;
export const DEFAULT_BIG_NUMBER_COLOR = { r: 51, g: 51, b: 51 }; // #333
export const DEFAULT_BIG_NUMBER_LEFT = 20;
export const DEFAULT_BIG_NUMBER_TOP = 50;

export const DEFAULT_COMPARISON1_LABEL = 'MoM';
export const DEFAULT_COMPARISON1_OFFSET = '1 month ago';
export const DEFAULT_COMPARISON1_LEFT = 20;

export const DEFAULT_COMPARISON2_LABEL = 'YoY';
export const DEFAULT_COMPARISON2_OFFSET = '1 year ago';
export const DEFAULT_COMPARISON2_LEFT = 120;

export const DEFAULT_COMPARISON_FONT_SIZE = 0.15;
export const DEFAULT_COMPARISON_TOP = 95;

export const DEFAULT_COMPARISON_POSITIVE_COLOR = { r: 0, g: 180, b: 42 }; // #00b42a
export const DEFAULT_COMPARISON_NEGATIVE_COLOR = { r: 245, g: 63, b: 63 }; // #f53f3f
export const DEFAULT_COMPARISON_ZERO_COLOR = { r: 102, g: 102, b: 102 }; // #666

export const DEFAULT_BACKGROUND_COLOR = { r: 255, g: 255, b: 255 }; // #fff

// Relative time shifts offered for the two comparison slots. Free text is
// still supported by the SelectControl so custom deltas are allowed.
export const COMPARISON_OFFSET_CHOICES = [
  ['1 day ago', '1 day ago'],
  ['1 week ago', '1 week ago'],
  ['28 days ago', '28 days ago'],
  ['30 days ago', '30 days ago'],
  ['1 month ago', '1 month ago'],
  ['52 weeks ago', '52 weeks ago'],
  ['1 year ago', '1 year ago'],
  ['104 weeks ago', '104 weeks ago'],
  ['2 years ago', '2 years ago'],
  ['156 weeks ago', '156 weeks ago'],
  ['3 years ago', '3 years ago'],
];
