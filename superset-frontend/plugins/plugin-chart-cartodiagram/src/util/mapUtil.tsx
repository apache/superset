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
 * Util for map related operations.
 */
import { Map } from 'ol';
import GeoJSON from 'ol/format/GeoJSON';
import { ChartConfig } from '../types';
import { getExtentFromFeatures } from './geometryUtil';

// default map extent of world if no features are found
// TODO: move to generic config file or plugin configuration
// TODO: adapt to CRS other than Web Mercator
const defaultExtent = [-16000000, -7279000, 20500000, 11000000];

/**
 * Fits map to the spatial extent of provided charts.
 *
 * @param olMap The OpenLayers map
 * @param chartConfigs The chart configuration
 */
export const fitMapToCharts = (olMap: Map, chartConfigs: ChartConfig) => {
  const view = olMap.getView();
  const features = new GeoJSON().readFeatures(chartConfigs, {
    // TODO: adapt to map projection
    featureProjection: 'EPSG:3857',
  });

  const extent = getExtentFromFeatures(features) || defaultExtent;

  view.fit(extent, {
    // tested for a desktop size monitor
    size: [250, 250],
  });
};
