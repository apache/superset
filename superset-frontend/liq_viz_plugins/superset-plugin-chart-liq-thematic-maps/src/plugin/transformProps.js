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

const defaults = require('../defaultLayerStyles.js');
const tradeAreaColors = defaults.tradeAreaColors;
 
export default function transformProps(chartProps) {
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
    customTileset
  } = formData;

  const data = queriesData[0].data;
  
  const groupCol = typeof formData.cols[0] === 'object' ? formData.cols[0].label : formData.cols[0];
  const metricCol = formData.metric.constructor === Array ? formData.metric[0].label : formData.metric.label;

  const isTradeArea = mapType.includes('trade_area');
  const isIntranet = mapType.includes('intranet');

  const tradeAreas = isTradeArea ? Array.from(new Set(data.map(d => d.Centre))) : [];
  let tradeAreaSA1s = {};
  let taSectorSA1Map = {};
  let taSectorColorMap = {};
  let sectorCentroids = {};

  let intranetData = {};

    data.map(d => {
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
        let data = {}
        Object.keys(d).map(k => {
          if (!(k === 'Layer' || k === groupCol || k == metricCol)) data[k] = d[k]
        })
        intranetData[d['Layer']][d[groupCol]] = data;
      }
    });

  let taSectorCentroids = {
    type: 'FeatureCollection',
    features: []
  };

  for (const k of Object.keys(sectorCentroids)) {
    taSectorCentroids.features.push({
      type: 'Feautre',
      geometry: {type: 'Point', coordinates: sectorCentroids[k].coordinates},
      properties: {label: k, centre: sectorCentroids[k].centre}
    });
  };

  const newRadiusColor = `rgba(${radiusColor.r},${radiusColor.g},${radiusColor.b},${radiusColor.a})`;

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
    newRadiusColor,
    radiusThreshold,
    customTileset
  };
}
