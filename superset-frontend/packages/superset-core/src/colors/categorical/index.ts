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

import { ColorSchemeConfig } from '../types';
import { categoricalAirbnb } from './airbnb';
import { categoricalBlueToGreen } from './blueToGreen';
import { categoricalColorsOfRainbow } from './colorsOfRainbow';
import { categoricalD3 } from './d3';
import { categoricalEcharts } from './echarts';
import { categoricalGoogle } from './google';
import { categoricalLyft } from './lyft';
import { categoricalModernSunset } from './modernSunset';
import { categoricalPreset } from './preset';
import { categoricalPresetAndSuperset } from './presetAndSuperset';
import { categoricalRedToYellow } from './redToYellow';
import { categoricalSuperset } from './superset';
import { categoricalWavesOfBlue } from './wavesOfBlue';

export { categoricalAirbnb } from './airbnb';
export { categoricalBlueToGreen } from './blueToGreen';
export { categoricalColorsOfRainbow } from './colorsOfRainbow';
export { categoricalD3 } from './d3';
export { categoricalEcharts } from './echarts';
export { categoricalGoogle } from './google';
export { categoricalLyft } from './lyft';
export { categoricalModernSunset } from './modernSunset';
export { categoricalPreset } from './preset';
export { categoricalPresetAndSuperset } from './presetAndSuperset';
export { categoricalRedToYellow } from './redToYellow';
export { categoricalSuperset } from './superset';
export { categoricalWavesOfBlue } from './wavesOfBlue';

/**
 * All built-in categorical color scheme configs in registration order.
 * `setupColors` iterates this array; append new palettes here to register them.
 */
export const allCategoricalColorSchemeConfigs: ColorSchemeConfig[] = [
  ...categoricalAirbnb,
  ...categoricalD3,
  ...categoricalEcharts,
  ...categoricalGoogle,
  ...categoricalLyft,
  ...categoricalPreset,
  ...categoricalSuperset,
  ...categoricalPresetAndSuperset,
  ...categoricalModernSunset,
  ...categoricalColorsOfRainbow,
  ...categoricalBlueToGreen,
  ...categoricalRedToYellow,
  ...categoricalWavesOfBlue,
];

/** The scheme id registered as default categorical color scheme. */
export const DEFAULT_CATEGORICAL_SCHEME = 'supersetColors';
