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
export const TIMESLIDER_HEIGHT = 28;

export enum TimesliderTooltipFormat {
  DATE,
  TIME,
  DATETIME,
}

export enum GeometryFormat {
  GEOJSON = 'GEOJSON',
  WKB = 'WKB',
  WKT = 'WKT',
}

// copy of
// superset-frontend/plugins/plugin-chart-echarts/src/constants.ts
export const NULL_STRING = '<NULL>';

export const SELECTION_LAYER_NAME = 'thematic-selection-layer';
export const LAYER_NAME_PROP = 'layerName';
export const SELECTION_BACKGROUND_OPACITY = 0.5;
export const FULL_OPACITY = 1;
