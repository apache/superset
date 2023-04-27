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
import { Feature, GeoJSON, LiqThematicMapsQueryFormData, RGBA, LiqMap, TASectorColour, TASectorCentroid, IntranetSchema, ThematicSchema } from '../types';

const defaults = require('../defaultLayerStyles.js');
const tradeAreaColors = defaults.tradeAreaColors;
 
export default function transformProps(chartProps : ChartProps) {
  /**
   * This function is called after a successful response has been
   * received from the chart data endpoint, and is used to transform
   * the incoming data prior to being sent to the Visualization.
   *
   * The transformProps function is also quite useful to return
   * additional/modified props to your data viz component. The formData
   * can also be accessed from your LiqThematicMaps.tsx file, but
   * doing supplying custom props here is often handy for integrating third
   * party libraries that rely on specific props.
   *
   * A description of properties in `chartProps`:
   * - `height`, `width`: the height/width of the DOM element in which
   *   the chart is located
   * - `formData`: the chart data request payload that was sent to the
   *   backend.
   * - `queriesData`: the chart data response payload that was received
   *   from the backend. Some notable properties of `queriesData`:
   *   - `data`: an array with data, each row with an object mapping
   *     the column/alias to its value. Example:
   *     `[{ col1: 'abc', metric1: 10 }, { col1: 'xyz', metric1: 20 }]`
   *   - `rowcount`: the number of rows in `data`
   *   - `query`: the query that was issued.
   *
   * Please note: the transformProps function gets cached when the
   * application loads. When making changes to the `transformProps`
   * function during development with hot reloading, changes won't
   * be seen until restarting the development server.
   */

  const { width, height, formData, queriesData } = chartProps;
  const { 
    mapType,
    mapStyle,
    boundary,
    intranetLayers, 
    features,
    linearColorScheme, 
    breaksMode,
    customMode,
    numClasses,
    opacity,
    latitude,
    longitude,
    zoom,
    radiusColor,
    radiusThreshold,
    radiusBorderColor,
    radiusBorderWidth,
    radiusLinkedCharts,
    drivetimeColor,
    drivetimeThreshold,
    drivetimeBorderColor,
    drivetimeBorderWidth,
    drivetimeLinkedCharts,
    intersectSa1Color,
    intersectSa1Width,
    customName,
    customType,
    customTileset,
    customDatabase,
    customSchema,
    customTable,
    customGeom,
    customShape,
    customColorAttributeCheck,
    customColorAttribute,
    customColor,
    customColorScheme,
    customColorBreaksMode,
    customColorMode,
    customColorNumClasses,
    customColorOpacity,
    customSizeAttributeCheck,
    customSizeAttribute,
    customSize,
    customSizeMultiplier,
    customSizeBreaksMode,
    customSizeMode,
    customSizeNumClasses
  } = formData as LiqThematicMapsQueryFormData;

  const data = queriesData[0].data;
  
  const groupCol = typeof formData.cols[0] === 'object' ? formData.cols[0].label : formData.cols[0];
  const metricCol = formData.metric.constructor === Array ? formData.metric[0].label : formData.metric.label;

  const isTradeArea = mapType.includes('trade_area');
  const isIntranet = mapType.includes('intranet');

  const tradeAreas = isTradeArea ? Array.from(new Set(data.map((d : any) => d.Centre))) : [];
  let tradeAreaSA1s = {} as LiqMap<string, TASectorColour>;
  let taSectorSA1Map = {} as LiqMap<string, string[]>;
  let taSectorColorMap = {} as LiqMap<string, string>;
  let sectorCentroids = {} as Record<string, TASectorCentroid>;

  let intranetData = {} as LiqMap<number, IntranetSchema>;

  data.map((d : any) => {
    if (isTradeArea) {
      if (!(d[groupCol] in tradeAreaSA1s)) tradeAreaSA1s[d[groupCol]] = {};
      if (!(d.Centre in tradeAreaSA1s[d[groupCol]])) tradeAreaSA1s[d[groupCol]][d.Centre] = {
        sector: d.Sector, colour: tradeAreaColors[d.Colour]
      };

      if (!(d.Centre in taSectorSA1Map)) taSectorSA1Map[d.Centre] = {};
      if (!(d.Sector in taSectorSA1Map[d.Centre])) taSectorSA1Map[d.Centre][d.Sector] = []
      taSectorSA1Map[d.Centre][d.Sector].push(d[groupCol].toString());
      
      if (!(d.Centre in taSectorColorMap)) taSectorColorMap[d.Centre] = {};
      if (!(d.Sector in taSectorColorMap[d.Centre])) taSectorColorMap[d.Centre][d.Sector] = tradeAreaColors[d.Colour];

      if (!(d.Sector in sectorCentroids) && ('lng' in d) && ('lat' in d)) sectorCentroids[d.Sector] = {
        coordinates: [d.lng, d.lat],
        centre: d.Centre
      }
    }
    if (isIntranet) {
      if (!(d['Layer'] in intranetData)) intranetData[d['Layer']] = {};
      let data = {} as IntranetSchema;
      Object.keys(d as IntranetSchema).map(k => {
        if (!(k === 'Layer' || k === groupCol || k == metricCol)) data[k] = d[k]
      })
      intranetData[d['Layer']][d[groupCol]] = data;
    }
  });

  let taSectorCentroids = {
    type: 'FeatureCollection',
    features: []
  } as GeoJSON;

  for (const k of Object.keys(sectorCentroids)) {
    const feat : Feature = {
      type: 'Feature',
      geometry: {type: 'Point', coordinates: sectorCentroids[k].coordinates},
      properties: {label: k, centre: sectorCentroids[k].centre}
    };
    taSectorCentroids.features?.push(feat);
  };

  let sectorLocs = {} as Record<string, [number, number]>;
  taSectorCentroids.features?.map(f => {
    sectorLocs[f.properties?.label] = [f.geometry.coordinates[0] as number, f.geometry.coordinates[1] as number];
  });
  const taLoc : [number, number] = sectorLocs[Object.keys(sectorLocs).sort((a, b) => a.localeCompare(b))[0]];

  const toRgbaStr = (color : RGBA) => `rgba(${color.r},${color.g},${color.b},${color.a})`;

  const newRadiusColor = toRgbaStr(radiusColor);
  const newDrivetimeColor = toRgbaStr(drivetimeColor);
  const newCustomColor = toRgbaStr(customColor);
  const newRadiusBorderColor = toRgbaStr(radiusBorderColor);
  const newDrivetimeBorderColor = toRgbaStr(drivetimeBorderColor);
  const newIntersectSa1Color = toRgbaStr(intersectSa1Color);

  const newRadiusLinkedCharts = radiusLinkedCharts ? radiusLinkedCharts.split(',').map(Number) : [];
  const newDrivetimeLinkedCharts = drivetimeLinkedCharts ? drivetimeLinkedCharts.split(',').map(Number) : [];

  return {
    width,
    height,
    data,
    groupCol,
    metricCol,
    // and now your control data, manipulated as needed, and passed through as props!
    mapType,
    mapStyle,
    boundary,
    intranetLayers,
    features,
    linearColorScheme,
    breaksMode,
    customMode,
    numClasses,
    tradeAreas,
    tradeAreaSA1s,
    taSectorSA1Map,
    taSectorColorMap,
    taSectorCentroids,
    intranetData,
    opacity,
    latitude,
    longitude,
    zoom,
    taLoc,
    newRadiusColor,
    radiusThreshold,
    newRadiusBorderColor,
    radiusBorderWidth,
    newRadiusLinkedCharts,
    newDrivetimeColor,
    drivetimeThreshold,
    newDrivetimeBorderColor,
    drivetimeBorderWidth,
    newDrivetimeLinkedCharts,
    newIntersectSa1Color,
    intersectSa1Width,
    customName,
    customType,
    customTileset,
    customDatabase,
    customSchema,
    customTable,
    customGeom,
    customShape,
    customColorAttributeCheck,
    customColorAttribute,
    newCustomColor,
    customColorScheme,
    customColorBreaksMode,
    customColorMode,
    customColorNumClasses,
    customColorOpacity,
    customSizeAttributeCheck,
    customSizeAttribute,
    customSize,
    customSizeMultiplier,
    customSizeBreaksMode,
    customSizeMode,
    customSizeNumClasses
  };
}
